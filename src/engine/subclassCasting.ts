import type { ClassData, SubclassData } from "../data/progression";

/**
 * The spellcasting of a class that has none of its own but whose subclass gives it (Eldritch
 * Knight, Arcane Trickster), as the class data the spell code already reads: the class's table
 * with the subclass's cantrips, spells known and slots laid over it. A level without a row of
 * its own keeps the last one before it.
 */
export function withSubclassCasting(data: ClassData, sub: SubclassData): ClassData | undefined {
  const casting = sub.spellcasting;
  if (!casting || data.spellcasting) return undefined;
  const rows = sub.levels.filter((r) => r.spellSlots).sort((a, b) => a.level - b.level);
  const at = (level: number) => [...rows].reverse().find((r) => r.level <= level);
  return {
    ...data,
    spellcasting: {
      ability: casting.ability,
      startsAtLevel: casting.startsAtLevel,
      ...(casting.kind === "pact" && { pact: true }),
      preparation: { type: "known" },
    },
    levels: data.levels.map((l) => {
      const row = at(l.level);
      return row
        ? {
            ...l,
            ...(row.spellSlots && { spellSlots: row.spellSlots }),
            ...(row.cantripsKnown !== undefined && { cantripsKnown: row.cantripsKnown }),
            ...(row.spellsKnown !== undefined && { spellsKnown: row.spellsKnown }),
          }
        : l;
    }),
  };
}
