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
/** A feat that gives horns: a natural weapon of 1d6 piercing. */
const horns: Entry = {
  id: "test:feat/horns",
  kind: "feat",
  effects: [{ type: "unarmedStrike", dice: "1d6", damageType: "piercing" }],
  data: { prerequisites: [], requirements: "" },
};
const index = new Map<string, Entry>([...srd51Index, [brawler.id, brawler], [horns.id, horns]]);

function make(classId: string, level: number, scores: Partial<Character["abilityBase"]> = {}) {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/human";
  c.classes = [{ classId: `srd51:class/${classId}`, level }];
  c.abilityBase = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...scores };
  return c;
}
const sheetOf = (c: Character) => deriveSheet(c, index);
const unarmed = (c: Character) => sheetOf(c).unarmed;
const armed = (c: Character, ...items: string[]) => {
  c.inventory = items.map((name) => ({
    itemId: `srd51:item/${name}`,
    quantity: 1,
    equipped: true,
  }));
  return c;
};

describe("the unarmed strike", () => {
  it("is there for a character with no weapon: Strength, proficiency, 1 + Strength bludgeoning", () => {
    const sheet = sheetOf(make("fighter", 1, { str: 16 }));
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
    expect(sheet.unarmed?.bonusAction).toBeUndefined();
  });

  it("takes off the negative modifier", () => {
    expect(unarmed(make("fighter", 1, { str: 8 }))?.damage).toMatchObject({ dice: "1", bonus: -1 });
  });

  it("is not offered to a fighter who holds a weapon: there is no free hand", () => {
    const sheet = sheetOf(armed(make("fighter", 1, { str: 16 }), "longsword"));
    expect(sheet.attacks).toHaveLength(1);
    expect(sheet.unarmed).toBeUndefined();
  });

  it("is a d4 with the feat Tavern Brawler", () => {
    const c = make("fighter", 1, { str: 16 });
    c.feats = [brawler.id];
    expect(unarmed(c)?.damage).toMatchObject({ dice: "1d4", bonus: 3 });
  });
});

describe("a natural weapon", () => {
  it("takes the place of the 1 with its die and its kind of damage", () => {
    const c = make("fighter", 1, { str: 16 });
    c.feats = [horns.id];
    expect(unarmed(c)).toMatchObject({
      natural: true,
      damage: { dice: "1d6", bonus: 3, type: "piercing" },
    });
  });

  it("is there even with a weapon in hand, and beats Tavern Brawler's d4", () => {
    const c = armed(make("fighter", 1, { str: 16 }), "longsword");
    c.feats = [horns.id, brawler.id];
    expect(unarmed(c)?.damage).toMatchObject({ dice: "1d6", type: "piercing" });
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
    expect(unarmed(make("monk", 1, { dex: 10, str: 16 }))?.ability).toBe("str");
  });

  it("is there with a monk weapon in hand too", () => {
    expect(unarmed(armed(make("monk", 1, { dex: 14 }), "quarterstaff"))).toBeDefined();
  });

  it("grows with the level: d4, d6, d8, d10", () => {
    const die = (level: number) => unarmed(make("monk", level, { dex: 14 }))?.damage?.dice;
    expect([die(1), die(5), die(11), die(17)]).toEqual(["1d4", "1d6", "1d8", "1d10"]);
  });

  it("keeps the martial arts die with Tavern Brawler", () => {
    const c = make("monk", 5, { dex: 14 });
    c.feats = [brawler.id];
    expect(unarmed(c)?.damage?.dice).toBe("1d6");
  });

  it("counts as magic from the 6th level, with Ki-Empowered Strikes", () => {
    expect(unarmed(make("monk", 5, { dex: 14 }))?.magical).toBe(false);
    expect(unarmed(make("monk", 6, { dex: 14 }))?.magical).toBe(true);
    expect(unarmed(make("fighter", 6, { str: 14 }))?.magical).toBe(false);
  });
});

describe("the weapons of a monk", () => {
  const attack = (c: Character, name: string) =>
    sheetOf(c).attacks.find((a) => a.itemId === `srd51:item/${name}`);

  it("use Dexterity when it is better, and the martial arts die when it is bigger", () => {
    const staff = attack(
      armed(make("monk", 5, { dex: 16, str: 8 }), "quarterstaff"),
      "quarterstaff",
    );
    expect(staff?.ability).toBe("dex");
    // Dexterity 16 (+3) and the proficiency bonus of the 5th level (+3).
    expect(staff?.attackBonus).toBe(3 + 3);
    // A d6 at the 5th level: the staff's own d6 stays, and its two-handed d8 stays too.
    expect(staff?.damage).toMatchObject({ dice: "1d6", bonus: 3 });
    expect(staff?.twoHandedDamage).toMatchObject({ dice: "1d8", bonus: 3 });
    const later = attack(
      armed(make("monk", 11, { dex: 16, str: 8 }), "quarterstaff"),
      "quarterstaff",
    );
    expect(later?.damage?.dice).toBe("1d8");
    expect(later?.twoHandedDamage?.dice).toBe("1d8");
    const sword = attack(armed(make("monk", 11, { dex: 16 }), "shortsword"), "shortsword");
    expect(sword?.damage?.dice).toBe("1d8");
  });

  it("do not change for a weapon that is not a monk weapon, or for another class", () => {
    const long = attack(armed(make("monk", 17, { dex: 16, str: 10 }), "longsword"), "longsword");
    expect(long?.ability).toBe("str");
    expect(long?.damage?.dice).toBe("1d8");
    const fighter = attack(
      armed(make("fighter", 11, { dex: 16, str: 8 }), "quarterstaff"),
      "quarterstaff",
    );
    expect(fighter?.ability).toBe("str");
    expect(fighter?.damage?.dice).toBe("1d6");
  });
});

describe("the ki save DC", () => {
  it("is 8 + proficiency + Wisdom, once the monk has ki", () => {
    const facts = (level: number) => sheetOf(make("monk", level, { wis: 14 })).facts;
    expect(facts(5).find((f) => f.kind === "kiSaveDc")?.params).toEqual({ dc: 8 + 3 + 2 });
    expect(facts(1).some((f) => f.kind === "kiSaveDc")).toBe(false);
    expect(sheetOf(make("fighter", 5)).facts.some((f) => f.kind === "kiSaveDc")).toBe(false);
  });
});
