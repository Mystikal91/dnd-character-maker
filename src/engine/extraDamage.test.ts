import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

const extrasOf = (slug: string, level: number) => {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/human";
  c.classes = [{ classId: `srd51:class/${slug}`, level }];
  return deriveSheet(c, srd51Index).extraDamage;
};

describe("the extra damage a class adds", () => {
  it("gives a rogue the sneak attack die of their level", () => {
    expect(extrasOf("rogue", 1)).toEqual([{ kind: "sneakAttack", dice: "1d6" }]);
    expect(extrasOf("rogue", 5)).toEqual([{ kind: "sneakAttack", dice: "3d6" }]);
    expect(extrasOf("rogue", 20)).toEqual([{ kind: "sneakAttack", dice: "10d6" }]);
  });

  it("gives a barbarian the rage bonus, and the brutal critical dice from level 9", () => {
    expect(extrasOf("barbarian", 1)).toEqual([{ kind: "rage", bonus: 2 }]);
    expect(extrasOf("barbarian", 9)).toEqual([
      { kind: "rage", bonus: 3 },
      { kind: "brutalCritical", dice: 1 },
    ]);
  });

  it("gives a paladin the divine smite from level 2", () => {
    expect(extrasOf("paladin", 1)).toEqual([]);
    expect(extrasOf("paladin", 2)).toEqual([{ kind: "divineSmite" }]);
  });

  it("gives a monk the martial arts die", () => {
    expect(extrasOf("monk", 1)).toEqual([{ kind: "martialArts", dice: "1d4" }]);
    expect(extrasOf("monk", 5)).toEqual([{ kind: "martialArts", dice: "1d6" }]);
  });

  it("gives nothing to a class without any", () => {
    expect(extrasOf("wizard", 5)).toEqual([]);
    expect(extrasOf("fighter", 5)).toEqual([]);
  });
});
