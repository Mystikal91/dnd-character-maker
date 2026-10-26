import type { Entry } from "../../data/schema";
import type { Character } from "../../engine/character";

/** What a pack held when it was imported: its entries, texts and where each came from. */
export interface PackSnapshot {
  entries: Entry[];
  strings: Record<string, string>;
  /** The entry each Aurora id became; packs imported before this was kept do not have it. */
  aids?: Record<string, string>;
}

const plain = (text: string | undefined) =>
  (text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const withoutNumber = (id: string) => id.replace(/-\d+$/, "");

/**
 * Which new id each old id of a pack became, for the ids that changed. When both imports know
 * the Aurora id of an entry, that decides. For a pack imported before that was kept, an entry is
 * matched by its kind, name and text; when several entries say the same, none is guessed.
 */
export function migrationMap(old: PackSnapshot, next: PackSnapshot): Map<string, string> {
  const map = new Map<string, string>();
  const known = new Set(next.entries.map((e) => e.id));

  for (const [aid, oldId] of Object.entries(old.aids ?? {})) {
    const newId = next.aids?.[aid];
    if (newId && newId !== oldId && known.has(newId)) map.set(oldId, newId);
  }
  // The entries the Aurora ids tell about: they moved (above) or kept their id.
  const decided = new Set(
    Object.entries(old.aids ?? {})
      .filter(([aid]) => next.aids?.[aid])
      .map(([, id]) => id),
  );
  const byKey = new Map<string, Entry[]>();
  for (const entry of next.entries) {
    const key = `${entry.kind}|${plain(next.strings[`${entry.id}.name`])}`;
    byKey.set(key, [...(byKey.get(key) ?? []), entry]);
  }

  for (const entry of old.entries) {
    if (decided.has(entry.id)) continue;
    const text = (e: Entry, side: PackSnapshot) => plain(side.strings[`${e.id}.desc`]);
    const candidates = byKey.get(`${entry.kind}|${plain(old.strings[`${entry.id}.name`])}`) ?? [];
    let found: Entry | undefined;
    if (candidates.length === 1) found = candidates[0];
    else if (candidates.length > 1) {
      const same = candidates.filter((c) => text(c, next) === text(entry, old));
      if (same.length === 1) found = same[0];
      else {
        const stem = same.filter((c) => withoutNumber(c.id) === withoutNumber(entry.id));
        if (stem.length === 1) found = stem[0];
      }
    }
    if (found && found.id !== entry.id && !map.has(entry.id)) map.set(entry.id, found.id);
  }
  return map;
}

const ENTRY_ID = /\b([a-z][a-z0-9]*):([a-z]+\/[a-z0-9-]+)/g;

/** The character with the ids in `map` replaced everywhere (picks and their keys included). */
export function migrateCharacter(
  character: Character,
  map: ReadonlyMap<string, string>,
): Character | undefined {
  if (map.size === 0) return undefined;
  const text = JSON.stringify(character);
  let changed = false;
  const fixed = text.replace(ENTRY_ID, (id) => {
    const to = map.get(id);
    if (to) changed = true;
    return to ?? id;
  });
  return changed ? (JSON.parse(fixed) as Character) : undefined;
}
