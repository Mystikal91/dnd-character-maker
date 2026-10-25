import type { Entry } from "../data/schema";
import type { Character } from "./character";

/** An id without the number that makes it unique: `pack:background/entertainer`. */
const stemOf = (id: string) => id.replace(/-\d+$/, "");

const ENTRY_ID = /\b([a-z][a-z0-9]*):([a-z]+\/[a-z0-9-]+)/g;

/**
 * Finds again what a character used from a pack that is no longer there under that id: a pack
 * imported anew on another device gets a new id, and the entries named after the old one are
 * gone. An id that the content does not know is replaced by the one entry of the content that
 * has the same kind and name (`impa:species/custom-lineage` for `impb:species/custom-lineage`),
 * or, in the same pack, the one that differs only by its number (`entertainer-2` for `entertainer`).
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

  // The entries of each pack by kind and name without the number, for ids numbered anew.
  const byStem = new Map<string, string[]>();
  const stems = new Set([...missing].map((id) => stemOf(id)));
  for (const id of index.keys()) {
    const stem = stemOf(id);
    if (stems.has(stem)) byStem.set(stem, [...(byStem.get(stem) ?? []), id]);
  }

  const replacement = new Map<string, string>();
  for (const id of missing) {
    const candidates = (found.get(id.slice(id.indexOf(":") + 1)) ?? []).filter(
      (c) => !/^srd\d+:/.test(c),
    );
    if (candidates.length === 1 && candidates[0]) replacement.set(id, candidates[0]);
    else if (candidates.length === 0) {
      // Not in another pack either: in the same pack, numbered otherwise (`entertainer-2`).
      const pack = id.slice(0, id.indexOf(":"));
      const same = (byStem.get(stemOf(id)) ?? []).filter((c) => c.startsWith(`${pack}:`));
      if (same.length === 1 && same[0]) replacement.set(id, same[0]);
    }
  }
  if (replacement.size === 0) return undefined;
  const fixed = text.replace(ENTRY_ID, (id) => replacement.get(id) ?? id);
  return JSON.parse(fixed) as Character;
}
