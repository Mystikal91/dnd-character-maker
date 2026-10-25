import type { Character } from "../engine/character";
import { CharacterParseError, parseCharacter } from "../engine/characterSchema";
import { carriedPacks } from "./carried";
import type { UserPackRecord } from "./packs";

const FORMAT = "dnd-character-maker";
const BACKUP_FORMAT = "dnd-character-maker-backup";

/**
 * The text of an export file for one character, with the homebrew packs it uses so that it opens
 * the same anywhere (a spell the person wrote, a class of their own).
 */
export function serializeCharacter(character: Character, homebrew: UserPackRecord[] = []): string {
  const doc = { format: FORMAT, character, ...(homebrew.length > 0 && { homebrew }) };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

/**
 * Reads an export file (or a bare character document). The result always gets a new id, so
 * importing can never overwrite an existing character.
 */
export function parseImport(text: string): Character {
  return parseImportFile(text).character;
}

/** Like `parseImport`, with the homebrew packs that came in the file. */
export function parseImportFile(text: string): { character: Character; packs: UserPackRecord[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new CharacterParseError("The file is not valid JSON");
  }
  const document =
    typeof raw === "object" && raw !== null && "format" in raw && "character" in raw
      ? (raw as { character: unknown }).character
      : raw;
  return {
    character: { ...parseCharacter(document), id: crypto.randomUUID() },
    packs: carriedPacks(raw),
  };
}

/** The text of a backup file: every character in one document. */
export function serializeBackup(characters: Character[], now = new Date()): string {
  return `${JSON.stringify(
    { format: BACKUP_FORMAT, version: 1, exportedAt: now.toISOString(), characters },
    null,
    2,
  )}\n`;
}

/**
 * Reads a backup file. Returns undefined when the text is not a backup (so it can be tried as a
 * single character), and counts the characters it could not read, such as ones saved by a newer
 * version of the app.
 */
export function parseBackup(
  text: string,
): { characters: Character[]; unreadable: number } | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof raw !== "object" || raw === null) return undefined;
  const doc = raw as { format?: unknown; characters?: unknown };
  if (doc.format !== BACKUP_FORMAT || !Array.isArray(doc.characters)) return undefined;
  const characters: Character[] = [];
  let unreadable = 0;
  for (const item of doc.characters) {
    try {
      characters.push(parseCharacter(item));
    } catch {
      unreadable += 1;
    }
  }
  return { characters, unreadable };
}

export const backupFileName = (now = new Date()) =>
  `dnd-characters-${now.toISOString().slice(0, 10)}.dndbackup.json`;

export function exportFileName(character: Character): string {
  const slug = character.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "character"}.dndchar.json`;
}
