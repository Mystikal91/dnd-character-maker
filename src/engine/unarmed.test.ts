import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { srd51Index } from "../test/srd51";
import { type Character, createCharacter } from "./character";
import { deriveSheet } from "./derive";

const brawler: Entry = {
  id: "test:feat/tavern-brawler",
  kind: "feat",
  effects: [],
  data: { prerequisites: [], requirements: "" },
};
const index = new Map<string, Entry>([...srd51Index, [brawler.id, brawler]]);

function make(classId: string, level: number, scores: Partial<Character["abilityBase"]> = {}) {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/human";
  c.classes = [{ classId: `srd51:class/${classId}`, level }];
  c.abilityBase = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...scores };
  return c;
}
const unarmed = (c: Character) => deriveSheet(c, index).unarmed;

describe("the unarmed strike", () => {
  it("is there for a character with no weapon: Strength, proficiency, 1 + Strength bludgeoning", () => {
    const sheet = deriveSheet(make("fighter", 1, { str: 16 }), index);
    expect(sheet.attacks).toEqual([]);
    expect(sheet.unarmed).toMatchObject({
      itemId: "unarmed",
      unarmed: true,
      ability: "str",
      proficient: true,
      ranged: false,
      attackBonus: 3 + 2,
      damage: { dice: "1", bonus: 3, type: "bludgeoning" },
    });
    expect(sheet.unarmed.bonusAction).toBeUndefined();
  });

  it("takes off the negative modifier, and stays with the weapons of the inventory", () => {
    const c = make("fighter", 1, { str: 8 });
    c.inventory = [{ itemId: "srd51:item/longsword", quantity: 1, equipped: true }];
    const sheet = deriveSheet(c, index);
    expect(sheet.attacks).toHaveLength(1);
    expect(sheet.unarmed.damage).toMatchObject({ dice: "1", bonus: -1 });
  });

  it("is a d4 with the feat Tavern Brawler", () => {
    const c = make("fighter", 1, { str: 16 });
    c.feats = [brawler.id];
    expect(unarmed(c).damage).toMatchObject({ dice: "1d4", bonus: 3 });
  });
});

describe("the unarmed strike of a monk", () => {
  it("uses the martial arts die and the better of Strength and Dexterity, and is a bonus action too", () => {
    const strike = unarmed(make("monk", 1, { dex: 16, str: 10 }));
    expect(strike).toMatchObject({
      ability: "dex",
      attackBonus: 3 + 2,
      damage: { dice: "1d4", bonus: 3 },
      bonusAction: true,
    });
    expect(unarmed(make("monk", 1, { dex: 10, str: 16 })).ability).toBe("str");
  });

  it("grows with the level: d4, d6, d8, d10", () => {
    const die = (level: number) => unarmed(make("monk", level, { dex: 14 })).damage?.dice;
    expect([die(1), die(5), die(11), die(17)]).toEqual(["1d4", "1d6", "1d8", "1d10"]);
  });

  it("keeps the martial arts die with Tavern Brawler", () => {
    const c = make("monk", 5, { dex: 14 });
    c.feats = [brawler.id];
    expect(unarmed(c).damage?.dice).toBe("1d6");
  });

  it("counts as magic from the 6th level, with Ki-Empowered Strikes", () => {
    expect(unarmed(make("monk", 5, { dex: 14 })).magical).toBe(false);
    expect(unarmed(make("monk", 6, { dex: 14 })).magical).toBe(true);
    expect(unarmed(make("fighter", 6, { str: 14 })).magical).toBe(false);
  });
});
