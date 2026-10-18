import type { Content } from "../content/browser";
import type { DerivedSheet } from "../engine/derive";

export interface SpellRow {
  id: string;
  level: number;
  /** Granted by a subclass, so always prepared and not counted against any limit. */
  alwaysPrepared: boolean;
}

/**
 * Every spell the character has: picked cantrips, known or prepared spells, subclass spells
 * and spells granted by species or traits. Ordered by level, then name.
 */
export function collectSpellRows(c: Content, s: DerivedSheet): SpellRow[] {
  const rows = new Map<string, SpellRow>();
  const add = (id: string, alwaysPrepared = false) => {
    const level = (c.index.get(id)?.data.level as number | undefined) ?? 0;
    rows.set(id, {
      id,
      level,
      alwaysPrepared: alwaysPrepared || (rows.get(id)?.alwaysPrepared ?? false),
    });
  };

  for (const { lists } of s.spellcasters) {
    for (const id of lists.cantrips?.chosen ?? []) add(id);
    // Known casters use their known list; prepared casters and wizards use what they prepared.
    const main = lists.preparation === "known" ? lists.known : lists.prepared;
    for (const id of main?.chosen ?? []) add(id);
    for (const id of lists.alwaysPrepared) add(id, true);
  }
  for (const id of s.grantedSpells) add(id);

  return [...rows.values()].sort(
    (a, b) => a.level - b.level || c.name(a.id).localeCompare(c.name(b.id)),
  );
}
