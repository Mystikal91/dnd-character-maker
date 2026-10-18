import { describe, expect, it } from "vitest";
import { ABILITIES } from "../data/schema";
import {
  POINT_BUY_BUDGET,
  STANDARD_ARRAY,
  applyAbilityMethod,
  assignValue,
  assignableValues,
  canLower,
  canRaise,
  pointBuyRemaining,
  pointBuySpent,
  rollAbilityScores,
  rollOneScore,
} from "./abilityScores";
import { createCharacter } from "./character";

/** A deterministic "random" source cycling through the given values in [0, 1). */
const cycle = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
};

describe("point buy", () => {
  it("starts at 8 everywhere with the full budget", () => {
    const c = createCharacter("srd51");
    applyAbilityMethod(c, "pointbuy");
    expect(Object.values(c.abilityBase)).toEqual([8, 8, 8, 8, 8, 8]);
    expect(pointBuyRemaining(c.abilityBase)).toBe(POINT_BUY_BUDGET);
  });

  it("prices scores per the SRD table and stops at 15 and at the budget", () => {
    const base = { str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 };
    expect(pointBuySpent(base)).toBe(27);
    expect(canRaise(base, "int")).toBe(false);
    expect(canRaise({ ...base, con: 13 }, "con")).toBe(true);
    expect(canRaise({ ...base, str: 14, con: 8 }, "str")).toBe(true);
    expect(canRaise(base, "str")).toBe(false);
    expect(canLower(base, "int")).toBe(false);
    expect(canLower(base, "str")).toBe(true);
  });

  it("treats scores outside 8-15 as unaffordable", () => {
    expect(pointBuySpent({ str: 16, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe("standard array and rolls", () => {
  it("assigns the standard array in ability order", () => {
    const c = createCharacter("srd51");
    applyAbilityMethod(c, "standard");
    expect(ABILITIES.map((a) => c.abilityBase[a])).toEqual(STANDARD_ARRAY);
    expect(assignableValues(c)).toEqual(STANDARD_ARRAY);
  });

  it("swaps with the ability that holds the chosen value", () => {
    const c = createCharacter("srd51");
    applyAbilityMethod(c, "standard");
    const next = assignValue(c.abilityBase, "str", 8);
    expect(next).toMatchObject({ str: 8, cha: 15 });
    expect(Object.values(next).sort()).toEqual([...STANDARD_ARRAY].sort());
  });

  it("rolls 4d6 dropping the lowest", () => {
    // Dice 6, 5, 4, 1 -> 15.
    expect(rollOneScore(cycle([0.99, 0.8, 0.5, 0]))).toBe(15);
    // All ones -> 3, the minimum.
    expect(rollOneScore(() => 0)).toBe(3);
  });

  it("keeps the rolled values and assigns them highest first", () => {
    expect(rollAbilityScores(() => 0.5)).toHaveLength(6);
    const c = createCharacter("srd51");
    applyAbilityMethod(c, "roll", cycle([0.99, 0.99, 0.99, 0.99, 0, 0, 0, 0]));
    expect(c.abilityRolls).toEqual([18, 18, 18, 3, 3, 3].slice(0, 6).sort((a, b) => b - a));
    expect(ABILITIES.map((a) => c.abilityBase[a])).toEqual(c.abilityRolls);
  });

  it("clears rolls and keeps scores when switching to manual", () => {
    const c = createCharacter("srd51");
    applyAbilityMethod(c, "roll");
    const scores = { ...c.abilityBase };
    applyAbilityMethod(c, "manual");
    expect(c.abilityRolls).toBeUndefined();
    expect(c.abilityBase).toEqual(scores);
  });
});
