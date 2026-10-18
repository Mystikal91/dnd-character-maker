import type { Ability } from "../data/schema";

/**
 * Free edit: values the player forces in place of the calculated ones. They live in
 * `Character.overrides` under these keys, and a missing key means "calculate it".
 */
export const OVERRIDE = {
  ability: (a: Ability) => `ability.${a}`,
  save: (a: Ability) => `save.${a}`,
  /** `slug` is the skill's id without its pack and kind, e.g. `perception`. */
  skill: (slug: string) => `skill.${slug}`,
  armorClass: "ac",
  hitPoints: "hp.max",
  speed: "speed",
  initiative: "initiative",
  proficiencyBonus: "proficiencyBonus",
  spellSaveDc: "spell.dc",
  spellAttack: "spell.attack",
} as const;

export type Overrides = Record<string, number | string | boolean>;

/** The forced number for a key, or undefined when the value is calculated. */
export function numberOverride(overrides: Overrides, key: string): number | undefined {
  const value = overrides[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * A copy of the overrides with `key` set to `value`, or removed when `value` is undefined
 * (the field was cleared, so the calculated value applies again).
 */
export function withOverride(
  overrides: Overrides,
  key: string,
  value: number | undefined,
): Overrides {
  const rest = Object.fromEntries(Object.entries(overrides).filter(([k]) => k !== key));
  return value === undefined ? rest : { ...rest, [key]: value };
}

/** How many numeric values are currently forced. */
export function countOverrides(overrides: Overrides): number {
  return Object.values(overrides).filter((v) => typeof v === "number").length;
}
