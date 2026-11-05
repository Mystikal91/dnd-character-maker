import { describe, expect, it } from "vitest";
import { hurtCompanion } from "./companions";
import { adjustDamage } from "./play";

describe("damage with a resistance or a vulnerability", () => {
  it("takes it as it is, halves it rounding down, or doubles it", () => {
    expect([0, 1, 7, 10, 25].map((n) => adjustDamage(n, "normal"))).toEqual([0, 1, 7, 10, 25]);
    expect([0, 1, 7, 10, 25].map((n) => adjustDamage(n, "resistant"))).toEqual([0, 0, 3, 5, 12]);
    expect([0, 1, 7, 10, 25].map((n) => adjustDamage(n, "vulnerable"))).toEqual([0, 2, 14, 20, 50]);
  });

  it("never gives a negative amount, and ignores a fraction", () => {
    for (const kind of ["normal", "resistant", "vulnerable"] as const) {
      expect(adjustDamage(-5, kind)).toBe(0);
    }
    expect(adjustDamage(7.9, "normal")).toBe(7);
  });

  it("works for a companion too: what is dealt is taken off its hit points", () => {
    const wolf = { id: "a", monster: "srd51:monster/wolf" };
    expect(hurtCompanion(wolf, 11, adjustDamage(8, "resistant")).hp).toBe(7);
    expect(hurtCompanion(wolf, 11, adjustDamage(8, "vulnerable")).hp).toBe(0);
  });
});
