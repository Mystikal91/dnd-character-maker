import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { actionRolls, resolveRolls } from "./monsterRolls";
import {
  type Owner,
  addToDice,
  plusValue,
  scaledArmorClass,
  scaledHitPoints,
  scaledPassivePerception,
  scaledSaves,
  scaledSkills,
} from "./scaling";

/** A level 5 ranger: proficiency +3, Wisdom +3, spell attack +6. */
const ranger: Owner = {
  pb: 3,
  spellAttack: 6,
  mods: { str: 0, dex: 2, con: 1, int: 0, wis: 3, cha: 0 },
  levelIn: (name) => (name === "ranger" || name === undefined ? 5 : 5),
};

const beast = (data: Record<string, unknown>): Entry => ({
  id: "imp1:monster/beast",
  kind: "monster",
  effects: [],
  data,
});

describe("what grows with the owner", () => {
  it("works out hit points from the level, and the modifiers the formula names", () => {
    const land = beast({
      scaling: { hitPoints: { base: 5, perLevel: 5, owner: [], own: [], class: "ranger" } },
    });
    expect(scaledHitPoints(land, ranger)).toBe(30);
    const defender = beast({
      abilities: { str: 14, dex: 12, con: 14, int: 4, wis: 10, cha: 6 },
      scaling: { hitPoints: { base: 2, perLevel: 5, owner: ["wis"], own: ["con"] } },
    });
    // 2 + 5 x 5 + the owner's Wisdom (3) + its own Constitution (14 gives +2).
    expect(scaledHitPoints(defender, ranger)).toBe(32);
    expect(scaledHitPoints(beast({}), ranger)).toBeUndefined();
  });

  it("adds the proficiency bonus or a modifier to the armor class", () => {
    expect(
      scaledArmorClass(beast({ armorClass: [{ value: 13, plus: "proficiency" }] }), ranger),
    ).toBe(16);
    expect(scaledArmorClass(beast({ armorClass: [{ value: 13, plus: "wis" }] }), ranger)).toBe(16);
    expect(scaledArmorClass(beast({ armorClass: [{ value: 13 }] }), ranger)).toBeUndefined();
  });

  it("adds the proficiency bonus to saves, skills and passive Perception, a number of times", () => {
    const e = beast({
      scaling: {
        saves: { dex: { base: 1, pb: 1 } },
        skills: { perception: { base: 0, pb: 2 } },
        passivePerception: { base: 10, pb: 2 },
      },
    });
    expect(scaledSaves(e, ranger)).toEqual({ dex: 4 });
    expect(scaledSkills(e, ranger)).toEqual({ perception: 6 });
    expect(scaledPassivePerception(e, ranger)).toBe(16);
    expect(scaledSaves(beast({}), ranger)).toBeUndefined();
  });

  it("reads what an action adds from its owner", () => {
    expect(plusValue(["pb", "wis"], ranger)).toBe(6);
    expect(plusValue(["spell"], ranger)).toBe(6);
    expect(plusValue(undefined, ranger)).toBe(0);
  });

  it("joins the numbers added to a roll", () => {
    expect(addToDice("1d8+2", 3)).toBe("1d8+5");
    expect(addToDice("1d8", 3)).toBe("1d8+3");
    expect(addToDice("1d8+2", -2)).toBe("1d8");
    expect(addToDice("1d8+4", -2)).toBe("1d8+2");
    expect(addToDice("3", 2)).toBe("5");
    expect(addToDice("1d6", 0)).toBe("1d6");
  });
});

describe("rolling an action that adds something of its owner", () => {
  const maul = actionRolls({
    attackBonus: 0,
    attackPlus: ["spell"],
    damage: [{ type: "slashing", dice: "1d8+2", plus: ["wis"] }],
  });

  it("has nothing to roll without an owner, and rolls with one", () => {
    expect(maul.scaled).toBe(true);
    expect(resolveRolls(maul, undefined)).toBeUndefined();
    expect(resolveRolls(maul, ranger)).toEqual({
      attackBonus: 6,
      damage: [{ type: "slashing", dice: "1d8+5" }],
      scaled: false,
    });
  });

  it("leaves an action with plain numbers as it is", () => {
    const bite = actionRolls({ attackBonus: 4, damage: [{ type: "piercing", dice: "2d4+2" }] });
    expect(resolveRolls(bite, undefined)).toBe(bite);
  });
});
