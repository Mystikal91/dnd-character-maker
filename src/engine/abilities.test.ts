import { describe, expect, it } from "vitest";
import { abilityModifier } from "./abilities";

describe("abilityModifier", () => {
  it.each([
    [1, -5],
    [8, -1],
    [10, 0],
    [11, 0],
    [15, 2],
    [20, 5],
  ])("score %i gives modifier %i", (score, expected) => {
    expect(abilityModifier(score)).toBe(expected);
  });
});
