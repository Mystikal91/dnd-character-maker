import type { ClassData } from "../data/progression";
import type { Ability } from "../data/schema";

/**
 * How a class casts spells: full casters (bard, cleric, druid, sorcerer, wizard), half casters
 * (paladin, ranger), and the warlock's Pact Magic. SRD 5.1 has no third casters: those are
 * subclasses (Eldritch Knight, Arcane Trickster) that the SRD does not include.
 */
export type CasterKind = "full" | "half" | "pact";

export function casterKind(classId: string, data: ClassData): CasterKind | undefined {
  if (!data.spellcasting) return undefined;
  if (classId.endsWith("/warlock")) return "pact";
  return data.spellcasting.startsAtLevel <= 1 ? "full" : "half";
}

/**
 * Spell slots of a multiclass spellcaster by combined caster level (SRD 5.1, "Multiclass
 * Spellcaster: Spell Slots per Spell Level"). Index 0 is caster level 1; each row lists the
 * slots of spell levels 1 to 9.
 */
export const MULTICLASS_SLOTS: number[][] = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

export interface CasterInput {
  kind: CasterKind;
  level: number;
  /** The slots this class has on its own table at its own level. */
  ownSlots: number[];
}

export interface SlotPools {
  /** Slots of spell levels 1 to 9 that every spellcasting class can use. */
  slots: number[];
  /** Pact Magic slots, when a warlock multiclasses with another caster: all of one level. */
  pact?: { level: number; count: number };
}

const NO_SLOTS = Array.from({ length: 9 }, () => 0);

/** Combined caster level: full caster levels plus half of the half casters' (rounded down). */
export function casterLevel(casters: CasterInput[]): number {
  return casters.reduce((sum, c) => {
    if (c.kind === "full") return sum + c.level;
    if (c.kind === "half") return sum + Math.floor(c.level / 2);
    return sum;
  }, 0);
}

/**
 * The slots a character shares among its classes. One casting class keeps its own table; two or
 * more (not counting the warlock) use the multiclass table; a warlock alongside another caster
 * keeps Pact Magic slots apart because they come back on a short rest.
 */
export function slotPools(casters: CasterInput[]): SlotPools {
  const shared = casters.filter((c) => c.kind !== "pact");
  const warlock = casters.find((c) => c.kind === "pact");

  let slots: number[];
  if (shared.length >= 2) {
    const level = Math.min(20, casterLevel(shared));
    slots = level >= 1 ? [...(MULTICLASS_SLOTS[level - 1] ?? NO_SLOTS)] : [...NO_SLOTS];
  } else if (shared.length === 1) {
    slots = [...(shared[0]?.ownSlots ?? NO_SLOTS)];
  } else {
    // A warlock on its own: its slots are the only ones, shown like any other.
    slots = [...(warlock?.ownSlots ?? NO_SLOTS)];
    return { slots };
  }

  if (!warlock) return { slots };
  const at = warlock.ownSlots.findIndex((n) => n > 0);
  return at === -1
    ? { slots }
    : { slots, pact: { level: at + 1, count: warlock.ownSlots[at] ?? 0 } };
}

export interface ScoreRequirement {
  ability: Ability;
  minimum: number;
}

/** The ability minimums a class asks of someone who multiclasses into (or out of) it. */
export function unmetPrerequisites(
  data: ClassData,
  score: (ability: Ability) => number,
): ScoreRequirement[] {
  const { prerequisites, prerequisiteOptions } = data.multiclassing;
  const unmet = prerequisites.filter((r) => score(r.ability) < r.minimum);
  if (prerequisiteOptions) {
    const met = prerequisiteOptions.from.filter((r) => score(r.ability) >= r.minimum).length;
    if (met < prerequisiteOptions.choose) unmet.push(...prerequisiteOptions.from);
  }
  return unmet;
}
