import * as v from "valibot";
import { type Pack, parsePack } from "../data/schema";
import { dbDelete, dbGetAll, dbPut } from "./db";

/**
 * A pack the user added on this device, with its texts.
 *
 * `personal` packs come from files the user already has (such as content imported from other
 * tools). They stay on this device: they can be removed but never exported or shared as a pack.
 * `homebrew` packs are the user's own work and can be exported.
 * `edits` is the pack of quick edits (the texts the user rewrote), one per language.
 */
export interface UserPackRecord {
  id: string;
  name: string;
  origin: "personal" | "homebrew" | "edits";
  addedAt: number;
  pack: Pack;
  /** Texts keyed by `<entry id>.<field>` (`name`, `desc`, ...). */
  strings: Record<string, string>;
  /** Language the texts are written in, e.g. `en`. */
  lang: string;
  /** Where an imported pack came from: the address, or the names of the files. */
  source?: { url?: string; files?: string[] };
  /** The version of the importer that made it (see `AURORA_IMPORT_VERSION`); absent in old packs. */
  importVersion?: number;
  /** Whether the 2024 versions were kept when it was imported, so importing again does the same. */
  keepEditions?: boolean;
  /** The entry each Aurora id became, so importing again can tell which entry is which. */
  aids?: Record<string, string>;
}

const RecordSchema = v.object({
  id: v.string(),
  name: v.string(),
  origin: v.picklist(["personal", "homebrew", "edits"]),
  addedAt: v.number(),
  pack: v.unknown(),
  strings: v.record(v.string(), v.string()),
  lang: v.string(),
  source: v.optional(
    v.object({ url: v.optional(v.string()), files: v.optional(v.array(v.string())) }),
  ),
  importVersion: v.optional(v.number()),
  keepEditions: v.optional(v.boolean()),
  aids: v.optional(v.record(v.string(), v.string())),
});

/** Ids of the packs that ship with the app: a user pack may not take their place. */
const RESERVED_IDS = new Set(["srd51", "srd52"]);

/**
 * The order packs apply in: what comes later wins. Content read from other tools first, then the
 * user's homebrew, then the quick edits, which always have the last word. Within one kind, the
 * pack added later wins.
 */
const APPLY_RANK = { personal: 0, homebrew: 1, edits: 2 } as const;
export const orderUserPacks = (records: UserPackRecord[]): UserPackRecord[] =>
  [...records].sort((a, b) => APPLY_RANK[a.origin] - APPLY_RANK[b.origin] || a.addedAt - b.addedAt);

/** An address shortened for a list: the site, then "..." and the file (`github.com/.../index.xml`). */
export function shortAddress(address: string): string {
  const max = 42;
  try {
    const url = new URL(address);
    const parts = url.pathname.split("/").filter(Boolean);
    const last = decodeURIComponent(parts[parts.length - 1] ?? "");
    const short = parts.length > 1 ? `${url.host}/…/${last}` : `${url.host}/${last}`;
    return short.length > max ? `${short.slice(0, max - 1)}…` : short;
  } catch {
    return address.length > max ? `${address.slice(0, max - 1)}…` : address;
  }
}

export class PackParseError extends Error {}

/** Validates what comes out of storage or a file; throws `PackParseError` when it is not a pack. */
export function parseUserPack(raw: unknown): UserPackRecord {
  const parsed = v.safeParse(RecordSchema, raw);
  if (!parsed.success) throw new PackParseError("Not a content pack");
  let pack: Pack;
  try {
    pack = parsePack(parsed.output.pack);
  } catch {
    throw new PackParseError("The pack data is not valid");
  }
  if (RESERVED_IDS.has(pack.manifest.id))
    throw new PackParseError("That pack id belongs to the content that ships with the app");
  if (pack.manifest.id !== parsed.output.id)
    throw new PackParseError("The pack id does not match its entries");
  return { ...parsed.output, pack };
}

export async function listUserPacks(): Promise<UserPackRecord[]> {
  const records = await dbGetAll<unknown>("packs");
  const packs: UserPackRecord[] = [];
  for (const record of records) {
    try {
      packs.push(parseUserPack(record));
    } catch {
      // A damaged pack is skipped rather than blocking the app.
    }
  }
  return packs.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveUserPack(record: UserPackRecord): Promise<void> {
  await dbPut("packs", parseUserPack(record));
}

export const deleteUserPack = (id: string) => dbDelete("packs", id);

const FORMAT = "dnd-character-maker-pack";

/** The text of a pack file. Only homebrew packs may be exported. */
export function serializePack(record: UserPackRecord): string {
  if (record.origin !== "homebrew") throw new PackParseError("Personal packs cannot be exported");
  const { origin: _origin, addedAt: _addedAt, ...rest } = record;
  return `${JSON.stringify({ format: FORMAT, ...rest }, null, 2)}\n`;
}

export function packFileName(record: UserPackRecord): string {
  const slug = record.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || record.id}.dndpack.json`;
}

/** Reads a pack file made by `serializePack`; the result is always a homebrew pack. */
export function parsePackFile(text: string, now = Date.now()): UserPackRecord {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new PackParseError("The file is not valid JSON");
  }
  if (typeof raw !== "object" || raw === null || (raw as { format?: unknown }).format !== FORMAT)
    throw new PackParseError("This is not a content pack file");
  return parseUserPack({ ...(raw as object), origin: "homebrew", addedAt: now });
}
