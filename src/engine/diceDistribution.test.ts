import { describe, expect, it } from "vitest";
import { rollD20, rollExpression } from "./dice";
import { parseDice } from "./dice";

/**
 * The dice must be fair. These roll a lot of dice with the real random source and check the
 * counts with a chi-square test; the limit is far out (a fair die fails it about once in a
 * hundred million runs), so a failure means a real bias, not bad luck.
 */
const CHI_LIMIT_D20 = 70; // 19 degrees of freedom
const CHI_LIMIT_D6 = 40; // 5 degrees of freedom

function chiSquare(counts: number[], total: number): number {
  const expected = total / counts.length;
  return counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
}

describe("the dice are fair", () => {
  it("a d20 lands on every face about as often", () => {
    const n = 400_000;
    const counts = new Array<number>(20).fill(0);
    for (let i = 0; i < n; i++) {
      const face = rollD20(0).used - 1;
      counts[face] = (counts[face] ?? 0) + 1;
    }
    expect(chiSquare(counts, n)).toBeLessThan(CHI_LIMIT_D20);
    // Natural 1 and natural 20 each come up one time in twenty.
    expect((counts[0] ?? 0) / n).toBeCloseTo(0.05, 2);
    expect((counts[19] ?? 0) / n).toBeCloseTo(0.05, 2);
  });

  it("a d6 from the dice box is fair too", () => {
    const expression = parseDice("1d6");
    if (!expression) throw new Error("1d6 did not parse");
    const n = 120_000;
    const counts = new Array<number>(6).fill(0);
    for (let i = 0; i < n; i++) {
      const face = (rollExpression(expression).rolls[0]?.[0] ?? 1) - 1;
      counts[face] = (counts[face] ?? 0) + 1;
    }
    expect(chiSquare(counts, n)).toBeLessThan(CHI_LIMIT_D6);
  });
});
