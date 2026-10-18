/** Minimal promise wrapper over IndexedDB: two object stores, no dependencies. */

const DB_NAME = "dnd-character-maker";
const DB_VERSION = 1;

export type StoreName = "characters" | "meta";

let connection: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
  connection ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("characters"))
        db.createObjectStore("characters", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the database"));
    request.onblocked = () => reject(new Error("The database is blocked by another tab"));
  });
  // A failed attempt must not be cached forever.
  connection.catch(() => {
    connection = undefined;
  });
  return connection;
}

/** Runs one request in its own transaction and resolves when the transaction commits. */
async function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  action: (objectStore: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const request = action(transaction.objectStore(store));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error ?? request.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("Transaction aborted"));
  });
}

export const dbGet = <T>(store: StoreName, key: IDBValidKey) =>
  run<T | undefined>(store, "readonly", (s) => s.get(key));

export const dbGetAll = <T>(store: StoreName) => run<T[]>(store, "readonly", (s) => s.getAll());

export const dbPut = (store: StoreName, value: unknown, key?: IDBValidKey) =>
  run(store, "readwrite", (s) => s.put(value, key));

export const dbDelete = (store: StoreName, key: IDBValidKey) =>
  run(store, "readwrite", (s) => s.delete(key));
