import { describe, expect, it } from "vitest";
import { createCharacter, createPlayState } from "./character";
import { parseCharacter } from "./characterSchema";
import {
  applyDamage,
  endRage,
  endRageIfDown,
  enterRage,
  halveDamage,
  longRest,
  resourceLeft,
  shortRest,
} from "./play";

const rage = { id: "rage:barbarian", max: 3 };

describe("a rage", () => {
  const start = createPlayState();

  it("uses up one of the rages", () => {
    const raging = enterRage(start, rage);
    expect(raging.raging).toBe(true);
    expect(resourceLeft(raging, rage.id, rage.max)).toBe(2);
  });

  it("costs nothing when the rages are unlimited", () => {
    const raging = enterRage(start);
    expect(raging.raging).toBe(true);
    expect(raging.resourcesUsed).toBeUndefined();
  });

  it("ends when the barbarian ends it, or falls unconscious", () => {
    const raging = enterRage(start, rage);
    expect(endRage(raging).raging).toBeUndefined();
    expect(endRage(start)).toBe(start);
    const hurt = applyDamage({ ...raging, hp: 5 }, 20, 4);
    expect(endRageIfDown(hurt, 20).raging).toBe(true);
    const down = applyDamage({ ...raging, hp: 5 }, 20, 9);
    expect(endRageIfDown(down, 20).raging).toBeUndefined();
  });

  it("ends with a rest, and the uses spent stay spent until a long one", () => {
    const raging = enterRage(start, rage);
    const short = shortRest(raging, "none");
    expect(short.raging).toBeUndefined();
    expect(resourceLeft(short, rage.id, rage.max)).toBe(2);
    expect(longRest(raging, {}).raging).toBeUndefined();
  });

  it("is kept with the character", () => {
    const c = createCharacter("srd51");
    c.play = enterRage(start, rage);
    expect(parseCharacter(JSON.parse(JSON.stringify(c))).play.raging).toBe(true);
  });
});

describe("resistance to damage", () => {
  it("halves the damage and rounds down", () => {
    expect([0, 1, 2, 7, 10, 25].map(halveDamage)).toEqual([0, 0, 1, 3, 5, 12]);
    expect(halveDamage(-4)).toBe(0);
  });
});
