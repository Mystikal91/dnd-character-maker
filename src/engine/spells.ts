import { type ClassData, subclassData } from "../data/progression";
import type { Entry } from "../data/schema";
import type { ClassSpells } from "./character";
import type { PackIndex } from "./derive";
import { type Warning, warn } from "./warnings";

/** One list of spells a class picks: how many it may hold, the picks, and what it may pick from. */
export interface SpellPick {
  allowed: number;
  /** Valid picks only, at most `allowed`. */
  chosen: string[];
  pool: string[];
}

export interface SpellLists {
  preparation: "known" | "prepared" | "spellbook";
  /** Highest spell level the class has slots for at its current level. */
  maxSpellLevel: number;
  cantrips?: SpellPick;
  /** Spells known (known casters) or the spellbook (wizards). */
  known?: SpellPick;
  /** Spells prepared today (prepared casters and wizards). */
  prepared?: SpellPick;
  /** Granted by the subclass, always prepared and not counted against any limit. */
  alwaysPrepared: string[];
}

interface Input {
  classId: string;
  data: ClassData;
  level: number;
  /** Modifier of the class's spellcasting ability. */
  abilityModifier: number;
  picks: ClassSpells | undefined;
  index: PackIndex;
  subclass: Entry | undefined;
  warnings: Warning[];
}

const spellLevel = (entry: Entry) => entry.data.level as number;

/** Spell ids on a class's list with a level in [min, max], sorted by level then id. */
function classSpellPool(index: PackIndex, classId: string, min: number, max: number): string[] {
  const found: Entry[] = [];
  for (const entry of index.values()) {
    if (entry.kind !== "spell") continue;
    if (!(entry.data.classes as string[]).includes(classId)) continue;
    if (spellLevel(entry) >= min && spellLevel(entry) <= max) found.push(entry);
  }
  return found
    .sort((a, b) => spellLevel(a) - spellLevel(b) || a.id.localeCompare(b.id))
    .map((e) => e.id);
}

/** The spells a patron adds to the list, within the levels the class can cast. */
function expandedPool(index: PackIndex, subclass: Entry | undefined, min: number, max: number) {
  const ids = subclass ? subclassData(subclass).expanded : [];
  return ids.filter((id) => {
    const level = index.get(id)?.data.level;
    return typeof level === "number" && level >= min && level <= max;
  });
}

/** Keeps the valid picks, warning about invalid and surplus ones. */
function resolvePick(
  requested: string[],
  allowed: number,
  pool: string[],
  classId: string,
  warnings: Warning[],
): SpellPick {
  const chosen: string[] = [];
  for (const spell of requested) {
    if (!pool.includes(spell)) warn(warnings, "invalidSpell", { spell, class: classId });
    else if (chosen.length >= allowed) warn(warnings, "tooManySpells", { class: classId });
    else if (!chosen.includes(spell)) chosen.push(spell);
  }
  return { allowed, chosen, pool };
}

/** The spell lists of one casting class at its current level (call only once it can cast). */
export function deriveSpellLists(input: Input): SpellLists {
  const { classId, data, level, abilityModifier, picks, index, subclass, warnings } = input;
  const casting = data.spellcasting;
  if (!casting) throw new Error(`${classId} is not a spellcasting class`);
  const row = data.levels.find((l) => l.level === level);
  const maxSpellLevel = (row?.spellSlots ?? []).reduce((max, n, i) => (n > 0 ? i + 1 : max), 0);

  const alwaysPrepared = subclass
    ? subclassData(subclass)
        .spells.filter((s) => s.classLevel <= level)
        .map((s) => s.spell)
    : [];

  const lists: SpellLists = {
    preparation: casting.preparation.type,
    maxSpellLevel,
    alwaysPrepared,
  };

  if (row?.cantripsKnown) {
    lists.cantrips = resolvePick(
      picks?.cantrips ?? [],
      row.cantripsKnown,
      [...classSpellPool(index, classId, 0, 0), ...expandedPool(index, subclass, 0, 0)],
      classId,
      warnings,
    );
  }

  const leveled = [
    ...new Set([
      ...classSpellPool(index, classId, 1, maxSpellLevel),
      ...expandedPool(index, subclass, 1, maxSpellLevel),
    ]),
  ];
  const preparation = casting.preparation;
  if (preparation.type === "known") {
    lists.known = resolvePick(
      picks?.known ?? [],
      row?.spellsKnown ?? 0,
      leveled,
      classId,
      warnings,
    );
  } else if (preparation.type === "prepared") {
    const count = Math.max(1, abilityModifier + Math.floor(level / preparation.levelDivisor));
    const pool = leveled.filter((s) => !alwaysPrepared.includes(s));
    lists.prepared = resolvePick(picks?.prepared ?? [], count, pool, classId, warnings);
  } else {
    const bookSize = preparation.initial + preparation.perLevel * (level - 1);
    lists.known = resolvePick(picks?.known ?? [], bookSize, leveled, classId, warnings);
    const count = Math.max(1, abilityModifier + level);
    lists.prepared = resolvePick(
      picks?.prepared ?? [],
      count,
      lists.known.chosen,
      classId,
      warnings,
    );
  }
  return lists;
}
