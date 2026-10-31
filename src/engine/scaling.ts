import type { Entry } from "../data/schema";

/**
 * What a creature that grows with the one it belongs to asks of its owner: the proficiency bonus,
 * the bonus to attack with spells, the modifiers of the abilities and the levels in the classes.
 * (A ranger's beast has `5 + five times your ranger level` hit points and `13 + PB` armor class.)
 */
export interface Owner {
  pb: number;
  spellAttack: number;
  /** Modifiers of the owner's abilities, by slug (`wis`). */
  mods: Record<string, number>;
  /** The level in a class, by slug; the highest level the owner has when the class is not theirs. */
  levelIn(className?: string): number;
}

interface HitPointScale {
  base: number;
  perLevel: number;
  owner: string[];
  own: string[];
  class?: string;
}

interface Scaled {
  base: number;
  pb: number;
}

interface Scaling {
  hitPoints?: HitPointScale;
  saves?: Record<string, Scaled>;
  skills?: Record<string, Scaled>;
  passivePerception?: Scaled;
}

const scalingOf = (entry: Entry | undefined): Scaling | undefined =>
  entry?.data.scaling as Scaling | undefined;

/** What an action adds from the owner: `pb`, `spell`, or the slug of an ability. */
export function plusValue(plus: readonly string[] | undefined, owner: Owner): number {
  return (plus ?? []).reduce(
    (n, what) =>
      n +
      (what === "pb" ? owner.pb : what === "spell" ? owner.spellAttack : (owner.mods[what] ?? 0)),
    0,
  );
}

const modifierOf = (score: number | undefined) => Math.floor(((score ?? 10) - 10) / 2);

/** The hit points the formula gives for this owner, or undefined when the creature has no formula. */
export function scaledHitPoints(entry: Entry | undefined, owner: Owner): number | undefined {
  const scale = scalingOf(entry)?.hitPoints;
  if (!scale) return undefined;
  const abilities = (entry?.data.abilities ?? {}) as Record<string, number>;
  const total =
    scale.base +
    scale.perLevel * owner.levelIn(scale.class) +
    scale.owner.reduce((n, a) => n + (owner.mods[a] ?? 0), 0) +
    scale.own.reduce((n, a) => n + modifierOf(abilities[a]), 0);
  return Math.max(1, total);
}

/** The armor class when it adds the proficiency bonus or an ability modifier of the owner. */
export function scaledArmorClass(entry: Entry | undefined, owner: Owner): number | undefined {
  const armor = (entry?.data.armorClass as { value: number; plus?: string }[] | undefined)?.[0];
  if (!armor?.plus) return undefined;
  return armor.value + (armor.plus === "proficiency" ? owner.pb : (owner.mods[armor.plus] ?? 0));
}

const worked = (map: Record<string, Scaled> | undefined, owner: Owner) =>
  map
    ? Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.base + v.pb * owner.pb]))
    : undefined;

/** Saving throw bonuses that add the proficiency bonus, by ability. */
export const scaledSaves = (entry: Entry | undefined, owner: Owner) =>
  worked(scalingOf(entry)?.saves, owner);

/** Skill bonuses that add the proficiency bonus, by skill slug. */
export const scaledSkills = (entry: Entry | undefined, owner: Owner) =>
  worked(scalingOf(entry)?.skills, owner);

export function scaledPassivePerception(
  entry: Entry | undefined,
  owner: Owner,
): number | undefined {
  const passive = scalingOf(entry)?.passivePerception;
  return passive ? passive.base + passive.pb * owner.pb : undefined;
}

/** Adds a number to a roll like `1d8+2`: the constants join, and a sum of 0 leaves the dice alone. */
export function addToDice(dice: string, extra: number): string {
  if (extra === 0) return dice;
  const tail = /([+-]\d+)$/.exec(dice);
  const sum = (tail ? Number(tail[1]) : 0) + extra;
  const head = tail ? dice.slice(0, dice.length - (tail[1] as string).length) : dice;
  if (!/d/i.test(head)) return String(Math.max(0, Number(head) + sum));
  return sum === 0 ? head : `${head}${sum > 0 ? "+" : ""}${sum}`;
}
