import { signal } from "@preact/signals";
import { AuroraParseError, parseAurora } from "../import/aurora";
import {
  PackParseError,
  type UserPackRecord,
  deleteUserPack,
  listUserPacks,
  packFileName,
  parsePackFile,
  saveUserPack,
  serializePack,
} from "../storage/packs";
import { content } from "./store";

/** The packs the user added, once read from storage. */
export const userPacks = signal<UserPackRecord[]>([]);

/** True once storage has been read (or turned out to be unavailable). */
export const userPacksReady = signal(false);

/** What went wrong with the last file the user tried to add, if anything. */
export const packError = signal<"invalid" | "exists" | undefined>(undefined);

export async function loadUserPacks(): Promise<void> {
  try {
    userPacks.value = await listUserPacks();
  } catch (error) {
    console.error("Reading content packs failed", error);
  } finally {
    userPacksReady.value = true;
  }
}

/** Adds a pack, replacing one with the same id. */
export async function addUserPack(record: UserPackRecord): Promise<void> {
  await saveUserPack(record);
  userPacks.value = [...userPacks.value.filter((p) => p.id !== record.id), record];
}

export async function removeUserPack(id: string): Promise<void> {
  await deleteUserPack(id);
  userPacks.value = userPacks.value.filter((p) => p.id !== id);
}

/** Adds the pack in a file the user chose (a pack made by this app's export). */
export async function importPackFile(file: File): Promise<void> {
  packError.value = undefined;
  try {
    const record = parsePackFile(await file.text());
    if (userPacks.value.some((p) => p.id === record.id && p.origin === "personal")) {
      packError.value = "exists";
      return;
    }
    await addUserPack(record);
  } catch (error) {
    if (!(error instanceof PackParseError)) console.error("Adding a pack failed", error);
    packError.value = "invalid";
  }
}

/** Downloads a homebrew pack as a file. */
export function exportPack(record: UserPackRecord): void {
  const url = URL.createObjectURL(new Blob([serializePack(record)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = packFileName(record);
  link.click();
  URL.revokeObjectURL(url);
}

/** What the last import of Aurora files did, shown on the packs page. */
export const importReport = signal<
  | {
      added: number;
      duplicates: number;
      skipped: Record<string, number>;
      name: string;
    }
  | undefined
>(undefined);

/**
 * Adds a personal pack from Aurora XML files the user chose. The files are read here and kept
 * only on this device; entries the app already has are left out.
 */
export async function importAuroraFiles(files: File[]): Promise<void> {
  const loaded = content.value;
  packError.value = undefined;
  importReport.value = undefined;
  if (!loaded || files.length === 0) return;
  try {
    const texts = await Promise.all(files.map((f) => f.text()));
    const names = new Map<string, Set<string>>();
    for (const entry of loaded.index.values()) {
      const set = names.get(entry.kind) ?? new Set<string>();
      set.add(loaded.name(entry.id).toLowerCase());
      names.set(entry.kind, set);
    }
    const id = `imp${Date.now().toString(36)}`;
    const result = parseAurora(texts, {
      packId: id,
      known: new Set(loaded.index.keys()),
      exists: (kind, name) => names.get(kind)?.has(name.toLowerCase()) ?? false,
    });
    const name = result.title || "Imported content";
    importReport.value = {
      added: result.entries.length,
      duplicates: result.duplicates,
      skipped: result.skipped,
      name,
    };
    if (result.entries.length === 0) return;
    await addUserPack({
      id,
      name,
      origin: "personal",
      addedAt: Date.now(),
      lang: "en",
      pack: {
        manifest: {
          id,
          ruleset: "custom",
          version: "1",
          license: "Personal use: files provided by the user",
          attribution: `Imported from files provided by the user. Sources: ${result.sources.join("; ") || "unknown"}.`,
        },
        entries: result.entries,
      },
      strings: result.strings,
    });
  } catch (error) {
    if (!(error instanceof AuroraParseError)) console.error("Importing files failed", error);
    packError.value = "invalid";
  }
}
