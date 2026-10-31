import { signal } from "@preact/signals";
import { loadContent } from "../content/browser";
import { AURORA_IMPORT_VERSION, AuroraParseError, parseAurora } from "../import/aurora";
import { migrationMap } from "../import/aurora/migrate";
import { gatherAurora, rawAddress } from "../import/aurora/remote";
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
import { migrateSavedCharacters } from "./migrate";
import { content } from "./store";

/** The packs the user added, once read from storage. */
export const userPacks = signal<UserPackRecord[]>([]);

/** True once storage has been read (or turned out to be unavailable). */
export const userPacksReady = signal(false);

/** What went wrong with the last file the user tried to add, if anything. */
export const packError = signal<"invalid" | "exists" | "sameAddress" | undefined>(undefined);

/** The pack that already came from the address the user typed, when that is the problem. */
export const sameAddressPack = signal<string | undefined>(undefined);

const normalAddress = (url: string) => rawAddress(url).replace(/\/+$/, "").toLowerCase();

/** The pack that was imported from this address, however it is written. */
export const packFromAddress = (url: string) =>
  userPacks.value.find((p) => p.source?.url && normalAddress(p.source.url) === normalAddress(url));

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
      merged: number;
      editions: number;
      skipped: Record<string, number>;
      unsupported: number;
      name: string;
      /** Addresses or files that could not be read. */
      failed: number;
      /** True when the search for files stopped at its limits. */
      truncated: boolean;
    }
  | undefined
>(undefined);

/** Files fetched so far while following an address or an index file. */
/** Keep the 2024 versions of what already has a 2014 one when importing from Aurora files. */
export const keepEditions = signal(false);

export const importProgress = signal<{ done: number; total: number } | undefined>(undefined);

/** A personal pack made by an older version of the importer than this one. */
export const isStale = (record: UserPackRecord) =>
  record.origin === "personal" && (record.importVersion ?? 0) < AURORA_IMPORT_VERSION;

/**
 * Adds a personal pack from Aurora XML files the user chose. The files are read here and kept
 * only on this device; entries the app already has are left out. With `replaceId` the pack of
 * that id is made again from the files, keeping its id so the characters that use it still work.
 */
export async function importAuroraFiles(files: File[], replaceId?: string): Promise<void> {
  const texts = await Promise.all(files.map((f) => f.text()));
  await importAuroraSources(
    texts.map((text) => ({ text })),
    replaceId,
    {
      files: files.map((f) => f.name),
    },
  );
}

/** Adds a personal pack from an address typed by the user: an index file or a content file. */
export async function importAuroraUrl(
  url: string,
  replaceId?: string,
  /** The id to give the new pack, when it is a copy of one made on another device. */
  wantedId?: string,
): Promise<void> {
  // The same address twice would only make a second copy of the pack.
  const known = replaceId ? undefined : packFromAddress(url);
  if (known) {
    importReport.value = undefined;
    sameAddressPack.value = known.name;
    packError.value = "sameAddress";
    return;
  }
  await importAuroraSources([{ url }], replaceId, { url }, wantedId);
}

/** Makes a pack again from the address it came from, with one click. */
export async function reimportPack(record: UserPackRecord): Promise<void> {
  const url = record.source?.url;
  if (url) await importAuroraUrl(url, record.id);
}

/** Makes again every outdated pack that remembers its address, one after the other. */
export async function reimportStalePacks(): Promise<void> {
  for (const record of userPacks.value.filter((r) => isStale(r) && r.source?.url))
    await reimportPack(record);
}

/**
 * Reads what the user gave, following index files to the content files they list. Fetching
 * starts only from a file or an address the user chose.
 */
async function importAuroraSources(
  start: { text?: string; url?: string }[],
  replaceId?: string,
  source?: UserPackRecord["source"],
  wantedId?: string,
): Promise<void> {
  const loaded = content.value;
  packError.value = undefined;
  importReport.value = undefined;
  if (!loaded || start.length === 0) return;
  try {
    importProgress.value = { done: 0, total: start.length };
    const gathered = await gatherAurora(start, {
      onProgress: (done, total) => {
        importProgress.value = { done, total };
      },
    });
    // Reading a large collection takes a few seconds: let the page show it is working first.
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Importing again keeps the id: the entries are named after it, and characters use them.
    const old = replaceId ? userPacks.value.find((p) => p.id === replaceId) : undefined;
    const taken = wantedId ? userPacks.value.some((p) => p.id === wantedId) : true;
    const id = old?.id ?? (wantedId && !taken ? wantedId : `imp${Date.now().toString(36)}`);
    const keep = old?.keepEditions ?? keepEditions.value;
    // Aurora content is in English, so duplicates are looked for by English names whatever the
    // language of the app is.
    const english = await loadContent(
      ["en"],
      userPacks.value.filter((p) => p.id !== id),
      { monsters: true },
    );
    const result = parseAurora(gathered.texts, {
      packId: id,
      index: english.index,
      nameOf: (entryId) => english.name(entryId),
      keepEditions: keep,
    });
    const name = `${gathered.title || result.title || "Imported content"} (Aurora)`;
    importReport.value = {
      added: result.entries.length,
      duplicates: result.duplicates,
      merged: result.merged,
      editions: result.editions,
      skipped: result.skipped,
      unsupported: result.unsupportedRules,
      name,
      failed: gathered.failed.length,
      truncated: gathered.truncated,
    };
    if (result.entries.length === 0) return;
    // Importing again can number or name entries otherwise: the characters follow them.
    const moved = old
      ? migrationMap(
          { entries: old.pack.entries, strings: old.strings, ...(old.aids && { aids: old.aids }) },
          { entries: result.entries, strings: result.strings, aids: result.aids },
        )
      : new Map<string, string>();
    await addUserPack({
      id,
      name,
      origin: "personal",
      addedAt: old?.addedAt ?? Date.now(),
      lang: "en",
      pack: {
        manifest: {
          id,
          ruleset: "custom",
          version: "1",
          license: "Personal use: content provided by the user",
          attribution: `Imported from content the user provided. Sources: ${result.sources.join("; ") || "unknown"}.`,
        },
        entries: result.entries,
      },
      strings: result.strings,
      ...(source && { source }),
      importVersion: AURORA_IMPORT_VERSION,
      keepEditions: keep,
      aids: result.aids,
    });
    await migrateSavedCharacters(moved);
  } catch (error) {
    if (!(error instanceof AuroraParseError)) console.error("Importing files failed", error);
    packError.value = "invalid";
  } finally {
    importProgress.value = undefined;
  }
}
