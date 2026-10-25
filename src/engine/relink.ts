import type { Entry } from "../data/schema";
import type { Character } from "./character";

const ENTRY_ID = /\b([a-z][a-z0-9]*):([a-z]+\/[a-z0-9-]+)/g;

/**
 * Finds again what a character used from a pack that is no longer there under that id: a pack
 * imported anew on another device gets a new id, and the entries named after the old one are
 * gone. An id that the content does not know is replaced by the one entry of the content that
 * has the same kind and name (`impa:species/custom-lineage` for `impb:species/custom-lineage`).
 * Ids that are ambiguous, or that match nothing, are left as they are. Returns the character
 * with the ids put right, or undefined when there was nothing to do.
 */
export function relinkCharacter(
  character: Character,
  index: ReadonlyMap<string, Entry>,
): Character | undefined {
  const text = JSON.stringify(character);
  const missing = new Set<string>();
  for (const match of text.matchAll(ENTRY_ID)) {
    const id = match[0];
    if (!index.has(id) && !/^srd\d+:/.test(id)) missing.add(id);
  }
  if (missing.size === 0) return undefined;

  // The entries of other packs by kind and name, only for what is needed.
  const wanted = new Set([...missing].map((id) => id.slice(id.indexOf(":") + 1)));
  const found = new Map<string, string[]>();
  for (const id of index.keys()) {
    const suffix = id.slice(id.indexOf(":") + 1);
    if (wanted.has(suffix)) found.set(suffix, [...(found.get(suffix) ?? []), id]);
  }

  const replacement = new Map<string, string>();
  for (const id of missing) {
    const candidates = (found.get(id.slice(id.indexOf(":") + 1)) ?? []).filter(
      (c) => !/^srd\d+:/.test(c),
    );
    if (candidates.length === 1 && candidates[0]) replacement.set(id, candidates[0]);
  }
  if (replacement.size === 0) return undefined;
  const fixed = text.replace(ENTRY_ID, (id) => replacement.get(id) ?? id);
  return JSON.parse(fixed) as Character;
}
