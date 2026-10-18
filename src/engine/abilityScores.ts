import { ABILITIES, type Ability } from "../data/schema";
import type { AbilityMethod, Character } from "./character";

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;
const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

/** Points spent by a set of scores; Infinity if any score is outside the 8-15 range. */
export function pointBuySpent(base: Record<Ability, number>): number {
  return ABILITIES.reduce(
    (sum, a) => sum + (POINT_BUY_COST[base[a]] ?? Number.POSITIVE_INFINITY),
    0,
  );
}

export const pointBuyRemaining = (base: Record<Ability, number>) =>
  POINT_BUY_BUDGET - pointBuySpent(base);

export function canRaise(base: Record<Ability, number>, ability: Ability): boolean {
  const current = POINT_BUY_COST[base[ability]];
  const next = POINT_BUY_COST[base[ability] + 1];
  return current !== undefined && next !== undefined && next - current <= pointBuyRemaining(base);
}

export const canLower = (base: Record<Ability, number>, ability: Ability) =>
  base[ability] > POINT_BUY_MIN;

/** One ability score by the usual method: roll four d6, drop the lowest, add the rest. */
export function rollOneScore(random: () => number = Math.random): number {
  const dice = Array.from({ length: 4 }, () => 1 + Math.floor(random() * 6));
  return dice.reduce((a, b) => a + b, 0) - Math.min(...dice);
}

export const rollAbilityScores = (random: () => number = Math.random) =>
  Array.from({ length: 6 }, () => rollOneScore(random)).sort((a, b) => b - a);

/** The values that can be assigned to abilities under `standard` or `roll`. */
export function assignableValues(character: Pick<Character, "abilityMethod" | "abilityRolls">) {
  if (character.abilityMethod === "standard") return STANDARD_ARRAY;
  if (character.abilityMethod === "roll") return character.abilityRolls ?? [];
  return [];
}

/**
 * Gives `ability` the chosen value. If another ability already holds it, the two swap, so the
 * set of values (standard array or rolls) is always preserved.
 */
export function assignValue(base: Record<Ability, number>, ability: Ability, value: number) {
  const next = { ...base };
  const holder = ABILITIES.find((a) => a !== ability && next[a] === value);
  if (holder) next[holder] = next[ability];
  next[ability] = value;
  return next;
}

/** Switches the generation method, resetting scores to a valid starting point for it. */
export function applyAbilityMethod(
  draft: Character,
  method: AbilityMethod,
  random: () => number = Math.random,
): void {
  draft.abilityMethod = method;
  draft.abilityRolls = undefined;
  if (method === "manual") return;

  let values: number[];
  if (method === "standard") {
    values = STANDARD_ARRAY;
  } else if (method === "roll") {
    values = rollAbilityScores(random);
    draft.abilityRolls = values;
  } else {
    values = ABILITIES.map(() => POINT_BUY_MIN);
  }
  ABILITIES.forEach((ability, i) => {
    draft.abilityBase[ability] = values[i] ?? POINT_BUY_MIN;
  });
}

/** Rolls a fresh set of six values and assigns them in order. */
export function reroll(draft: Character, random: () => number = Math.random): void {
  applyAbilityMethod(draft, "roll", random);
}
