import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { createCharacter } from "./character";
import { parseCharacter } from "./characterSchema";
import {
  companionHp,
  companionMax,
  healCompanion,
  hurtCompanion,
  isFamiliar,
  monstersOf,
} from "./companions";

const monster = (id: string, data: Record<string, unknown> = {}): Entry => ({
  id,
  kind: "monster",
  effects: [],
  data,
});

describe("which monsters can be familiars", () => {
  it("takes the forms of Find Familiar from the SRD and the ones a book lists", () => {
    expect(isFamiliar(monster("srd51:monster/owl"))).toBe(true);
    expect(isFamiliar(monster("srd51:monster/poisonous-snake"))).toBe(true);
    expect(isFamiliar(monster("srd51:monster/wolf"))).toBe(false);
    expect(isFamiliar(monster("imp1:monster/badger", { uses: ["familiar"] }))).toBe(true);
    expect(isFamiliar(monster("imp1:monster/rat", { uses: ["variant-familiar"] }))).toBe(true);
    expect(isFamiliar(monster("imp1:monster/drake", { uses: ["drake-companion"] }))).toBe(false);
    expect(isFamiliar(monster("imp1:monster/plain"))).toBe(false);
  });

  it("finds the monsters among the entries", () => {
    const spell: Entry = { id: "a:spell/y", kind: "spell", effects: [], data: {} };
    const index = new Map<string, Entry>();
    for (const e of [monster("a:monster/x"), spell]) index.set(e.id, e);
    expect(monstersOf(index).map((e) => e.id)).toEqual(["a:monster/x"]);
  });
});

describe("hit points of a companion", () => {
  const owl = monster("srd51:monster/owl", { hitPoints: 1 });
  const base = { id: "1", monster: owl.id };

  it("takes the maximum from the monster, or from what the person wrote", () => {
    expect(companionMax(base, owl)).toBe(1);
    expect(companionMax({ ...base, maxHp: 9 }, owl)).toBe(9);
    expect(companionMax(base, monster("imp1:monster/beast"))).toBeUndefined();
    expect(companionMax(base, undefined)).toBeUndefined();
  });

  it("is at full health until it is hurt", () => {
    expect(companionHp(base, 13)).toBe(13);
    const hurt = hurtCompanion(base, 13, 5);
    expect(hurt.hp).toBe(8);
    expect(healCompanion(hurt, 13, 3).hp).toBe(11);
  });

  it("does not go below 0 or above the maximum", () => {
    expect(hurtCompanion(base, 4, 100).hp).toBe(0);
    expect(healCompanion({ ...base, hp: 3 }, 4, 100).hp).toBe(4);
    expect(hurtCompanion(base, 4, -2)).toBe(base);
    expect(healCompanion(base, 4, 0)).toBe(base);
    // A maximum that came down: what was kept is held to it.
    expect(companionHp({ ...base, hp: 20 }, 10)).toBe(10);
  });
});

describe("saving companions", () => {
  it("keeps them with the character, and opens characters saved without any", () => {
    const c = createCharacter("srd51");
    expect(parseCharacter(JSON.parse(JSON.stringify(c))).companions).toBeUndefined();
    c.companions = [{ id: "a", monster: "srd51:monster/owl", name: "Hoot", hp: 1, maxHp: 1 }];
    expect(parseCharacter(JSON.parse(JSON.stringify(c))).companions).toEqual(c.companions);
  });
});
