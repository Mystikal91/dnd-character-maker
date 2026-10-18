import { describe, expect, it } from "vitest";
import {
  type RandomInt,
  cryptoRandomInt,
  formatDice,
  parseDice,
  rollD20,
  rollExpression,
} from "./dice";

/** A random source that returns the given values in order (each is a die face minus one). */
const sequence = (values: number[]): RandomInt => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
};

describe("parseDice", () => {
  it("reads single dice, sums and modifiers", () => {
    expect(parseDice("d20")).toEqual({ terms: [{ count: 1, sides: 20 }], modifier: 0 });
    expect(parseDice("2d6+3")).toEqual({ terms: [{ count: 2, sides: 6 }], modifier: 3 });
    expect(parseDice(" 1d8 + 1d4 - 1 ")).toEqual({
      terms: [
        { count: 1, sides: 8 },
        { count: 1, sides: 4 },
      ],
      modifier: -1,
    });
    expect(parseDice("D10+2")?.terms).toEqual([{ count: 1, sides: 10 }]);
  });

  it.each(["", "abc", "2d", "d1", "0d6", "101d6", "2d6+", "2d6--1", "5", "-1d6", "1d6-1d4"])(
    "rejects %j",
    (text) => {
      expect(parseDice(text)).toBeUndefined();
    },
  );

  it("formats an expression back to text", () => {
    const parsed = parseDice("2d6 + 3");
    expect(parsed && formatDice(parsed)).toBe("2d6+3");
  });
});

describe("rollExpression", () => {
  it("adds the faces and the modifier", () => {
    const parsed = parseDice("2d6+3");
    if (!parsed) throw new Error("parse failed");
    const roll = rollExpression(parsed, sequence([5, 2])); // faces 6 and 3
    expect(roll).toEqual({ expression: "2d6+3", rolls: [[6, 3]], modifier: 3, total: 12 });
  });
});

describe("rollD20", () => {
  it("rolls once with a bonus and flags a natural 20 or 1", () => {
    expect(rollD20(5, "normal", sequence([13]))).toMatchObject({
      used: 14,
      total: 19,
      critical: false,
    });
    expect(rollD20(0, "normal", sequence([19]))).toMatchObject({ critical: true, fumble: false });
    expect(rollD20(0, "normal", sequence([0]))).toMatchObject({ critical: false, fumble: true });
  });

  it("keeps the higher die with advantage and the lower with disadvantage", () => {
    expect(rollD20(2, "advantage", sequence([4, 16]))).toMatchObject({
      dice: [5, 17],
      used: 17,
      total: 19,
    });
    expect(rollD20(2, "disadvantage", sequence([4, 16]))).toMatchObject({
      dice: [5, 17],
      used: 5,
      total: 7,
    });
  });
});

describe("cryptoRandomInt", () => {
  it("stays in range and covers every face of a die", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 600; i++) {
      const n = cryptoRandomInt(6);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
      seen.add(n);
    }
    expect(seen.size).toBe(6);
  });
});
