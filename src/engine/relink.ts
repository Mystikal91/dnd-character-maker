import type { Entry } from "../data/schema";
import type { Character } from "./character";

/** An id without the number that makes it unique: `pack:background/entertainer`. */
const stemOf = (id: string) => id.replace(/-\d+$/, "");

const ENTRY_ID = /\b([a-z][a-z0-9]*):([a-z]+\/[a-z0-9-]+)/g;

const isSrd = (id: string) => /^srd\d+:/.test(id);
const suffixOf = (id: string) => id.slice(id.indexOf(":") + 1);

/**
 * A function that finds again an entry of a pack that is no longer there under that id: a pack
 * imported anew (on another device, or downloaded again to update it) gets a new id, and the
 * entries named after the old one are gone. For an id that the content does not know it gives
 * the one entry of another pack with the same kind and name (`impa:species/custom-lineage` for
 * `impb:species/custom-lineage`) or, in the same pack, the one that differs only by its number
 * (`entertainer-2` for `entertainer`). It gives nothing for an id that is known, that is of the
 * SRD, that is ambiguous, or that matches nothing.
 */
export function entryRelinker(
  index: ReadonlyMap<string, Entry>,
): (id: string) => string | undefined {
  let bySuffix: Map<string, string[]> | undefined;
  let byStem: Map<string, string[]> | undefined;
  const build = () => {
    bySuffix = new Map();
    byStem = new Map();
    for (const id of index.keys()) {
      if (isSrd(id)) continue;
      const suffix = suffixOf(id);
      bySuffix.set(suffix, [...(bySuffix.get(suffix) ?? []), id]);
      const stem = stemOf(id);
      byStem.set(stem, [...(byStem.get(stem) ?? []), id]);
    }
  };
  return (id) => {
    if (index.has(id) || isSrd(id)) return undefined;
    if (!bySuffix || !byStem) build();
    const others = bySuffix?.get(suffixOf(id)) ?? [];
    if (others.length === 1) return others[0];
    if (others.length > 1) return undefined;
    // Not in another pack either: in the same pack, numbered otherwise (`entertainer-2`).
    const pack = id.slice(0, id.indexOf(":"));
    const same = (byStem?.get(stemOf(id)) ?? []).filter((c) => c.startsWith(`${pack}:`));
    return same.length === 1 ? same[0] : undefined;
  };
}

/**
 * Finds again what a character used from a pack that is no longer there under that id (see
 * `entryRelinker`). Returns the character with the ids put right, or undefined when there was
 * nothing to do.
 */
export function relinkCharacter(
  character: Character,
  index: ReadonlyMap<string, Entry>,
): Character | undefined {
  const text = JSON.stringify(character);
  const relink = entryRelinker(index);
  const replacement = new Map<string, string>();
  for (const match of text.matchAll(ENTRY_ID)) {
    const id = match[0];
    if (replacement.has(id)) continue;
    const found = relink(id);
    if (found) replacement.set(id, found);
  }
  if (replacement.size === 0) return undefined;
  const fixed = text.replace(ENTRY_ID, (id) => replacement.get(id) ?? id);
  return JSON.parse(fixed) as Character;
}
