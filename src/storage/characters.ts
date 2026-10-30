import type { Character } from "../engine/character";
import { CharacterParseError, parseCharacter } from "../engine/characterSchema";
import { dbDelete, dbGet, dbGetAll, dbPut } from "./db";

/** What is stored per character: the document plus when it last changed. */
interface CharacterRecord {
  id: string;
  updatedAt: number;
  character: Character;
}

export interface CharacterSummary {
  id: string;
  name: string;
  updatedAt: number;
  /** The classes and levels, so the list can say "Elowen \u00b7 Wizard 3". */
  classes: { classId: string; level: number }[];
}

const CURRENT_KEY = "currentCharacterId";

/**
 * Stores a character. Saving one that has not changed (opening it saves it too) leaves its date as
 * it was, so the date tells when it was last edited, not when it was last looked at.
 */
export async function saveCharacter(character: Character, now = Date.now()): Promise<void> {
  const before = await dbGet<CharacterRecord>("characters", character.id);
  if (before && JSON.stringify(before.character) === JSON.stringify(character)) return;
  const record: CharacterRecord = { id: character.id, updatedAt: now, character };
  await dbPut("characters", record);
}

/** Loads and validates one character; returns undefined if it is missing or unreadable. */
export async function loadCharacter(id: string): Promise<Character | undefined> {
  const record = await dbGet<CharacterRecord>("characters", id);
  if (!record) return undefined;
  try {
    return parseCharacter(record.character);
  } catch (error) {
    if (error instanceof CharacterParseError) return undefined;
    throw error;
  }
}

/** All saved characters, most recently changed first. Unreadable records are skipped. */
export async function listCharacters(): Promise<CharacterSummary[]> {
  const records = await dbGetAll<CharacterRecord>("characters");
  return records
    .map((r) => ({
      id: r.id,
      name: r.character?.name ?? "",
      updatedAt: r.updatedAt,
      classes: (r.character?.classes ?? []).map((c) => ({ classId: c.classId, level: c.level })),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export const deleteCharacter = (id: string) => dbDelete("characters", id);

export const getCurrentId = () => dbGet<string>("meta", CURRENT_KEY);
export const setCurrentId = (id: string) => dbPut("meta", id, CURRENT_KEY);

/** Asks the browser not to evict our data under storage pressure. Best effort. */
export async function requestPersistence(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Not supported or denied: nothing to do.
  }
}
