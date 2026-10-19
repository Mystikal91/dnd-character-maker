import { signal } from "@preact/signals";
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
