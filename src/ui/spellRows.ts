import type { Content } from "../content/browser";
import type { DerivedSheet } from "../engine/derive";

export interface SpellRow {
  id: string;
  level: number;
  /** Granted by a subclass, so always prepared and not counted against any limit. */
  alwaysPrepared: boolean;
  /** Cast as often as wanted without a slot (an invocation gives it): listed with the cantrips, `level` 0. */
  atWill: boolean;
}

/**
 * Every spell the character has: picked cantrips, known or prepared spells, subclass spells
 * and spells granted by species or traits. Ordered by level, then name.
 */
export function collectSpellRows(c: Content, s: DerivedSheet): SpellRow[] {
  const rows = new Map<string, SpellRow>();
  const add = (id: string, alwaysPrepared = false, atWill = false) => {
    const free = atWill || (rows.get(id)?.atWill ?? false);
    // A spell cast at will is treated as a cantrip: no slot, no level.
    const level = free ? 0 : ((c.index.get(id)?.data.level as number | undefined) ?? 0);
    rows.set(id, {
      id,
      level,
      alwaysPrepared: alwaysPrepared || (rows.get(id)?.alwaysPrepared ?? false),
      atWill: free,
    });
  };

  for (const { lists } of s.spellcasters) {
    for (const id of lists.cantrips?.chosen ?? []) add(id);
    // Known casters use their known list; prepared casters and wizards use what they prepared.
    const main = lists.preparation === "known" ? lists.known : lists.prepared;
    for (const id of main?.chosen ?? []) add(id);
    for (const id of lists.alwaysPrepared) add(id, true);
  }
  for (const id of s.grantedSpells) add(id, false, s.atWillSpells.includes(id));

  return [...rows.values()].sort(
    (a, b) => a.level - b.level || c.name(a.id).localeCompare(c.name(b.id)),
  );
}
