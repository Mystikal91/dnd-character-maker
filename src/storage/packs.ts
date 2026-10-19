import * as v from "valibot";
import { type Pack, parsePack } from "../data/schema";
import { dbDelete, dbGetAll, dbPut } from "./db";

/**
 * A pack the user added on this device, with its texts.
 *
 * `personal` packs come from files the user already has (such as content imported from other
 * tools). They stay on this device: they can be removed but never exported or shared as a pack.
 * `homebrew` packs are the user's own work and can be exported.
 */
export interface UserPackRecord {
  id: string;
  name: string;
  origin: "personal" | "homebrew";
  addedAt: number;
  pack: Pack;
  /** Texts keyed by `<entry id>.<field>` (`name`, `desc`, ...). */
  strings: Record<string, string>;
  /** Language the texts are written in, e.g. `en`. */
  lang: string;
}

const RecordSchema = v.object({
  id: v.string(),
  name: v.string(),
  origin: v.picklist(["personal", "homebrew"]),
  addedAt: v.number(),
  pack: v.unknown(),
  strings: v.record(v.string(), v.string()),
  lang: v.string(),
});

/** Ids of the packs that ship with the app: a user pack may not take their place. */
const RESERVED_IDS = new Set(["srd51", "srd52"]);

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
