import type { Character } from "../engine/character";
import { CharacterParseError, parseCharacter } from "../engine/characterSchema";

const FORMAT = "dnd-character-maker";

/** The text of an export file for one character. */
export function serializeCharacter(character: Character): string {
  return `${JSON.stringify({ format: FORMAT, character }, null, 2)}\n`;
}

/**
 * Reads an export file (or a bare character document). The result always gets a new id, so
 * importing can never overwrite an existing character.
 */
export function parseImport(text: string): Character {
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
  return { ...parseCharacter(document), id: crypto.randomUUID() };
}

export function exportFileName(character: Character): string {
  const slug = character.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "character"}.dndchar.json`;
}
