import { describe, expect, it } from "vitest";
import { srd51Index as index } from "../test/srd51";
import { type Character, createCharacter } from "./character";
import { deriveSheet } from "./derive";

function make(
  classId: string,
  level: number,
  scores: Partial<Character["abilityBase"]>,
  items: string[] = [],
  species = "human",
) {
  const c = createCharacter("srd51");
  c.choices.species = `srd51:species/${species}`;
  c.classes = [{ classId: `srd51:class/${classId}`, level }];
  c.abilityBase = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...scores };
  c.inventory = items.map((name) => ({
    itemId: `srd51:item/${name}`,
    quantity: 1,
    equipped: true,
  }));
  return c;
}

const STYLE = "srd51:feature/fighter-fighting-style/option";
const style = (name: string) => `srd51:feature/fighter-fighting-style-${name}`;

describe("fighting styles", () => {
  it("offers the six styles to a fighter and counts the pick as open", () => {
    const sheet = deriveSheet(make("fighter", 1, {}), index);
    const choice = sheet.choices.find((c) => c.key === STYLE);
    expect(choice?.options).toHaveLength(6);
    expect(choice?.remaining).toBe(1);
  });

  it("adds +2 to ranged attacks with Archery, and only to those", () => {
    const c = make("fighter", 1, { dex: 16, str: 10 }, ["longbow", "longsword"]);
    c.selections[STYLE] = [style("archery")];
    const sheet = deriveSheet(c, index);
    const bow = sheet.attacks.find((a) => a.itemId.endsWith("longbow"));
    const sword = sheet.attacks.find((a) => a.itemId.endsWith("longsword"));
    expect(bow?.attackBonus).toBe(3 + 2 + 2);
    expect(sword?.attackBonus).toBe(0 + 2);
    expect(sheet.traits).toContain(style("archery"));
    expect(sheet.bonuses).toContainEqual({ target: "attack", value: 2, source: style("archery") });
  });

  it("adds +1 AC with Defense only while wearing armor", () => {
    const c = make("fighter", 1, { dex: 12 }, ["chain-mail"]);
    c.selections[STYLE] = [style("defense")];
    expect(deriveSheet(c, index).armorClass.value).toBe(16 + 1);
    c.inventory = [];
    expect(deriveSheet(c, index).armorClass.value).toBe(11);
  });

  it("adds +2 damage with Dueling to a lone one-handed melee weapon", () => {
    const c = make("fighter", 1, { str: 16 }, ["longsword"]);
    c.selections[STYLE] = [style("dueling")];
    const alone = deriveSheet(c, index).attacks[0];
    expect(alone?.damage?.bonus).toBe(3 + 2);
    // A versatile weapon held in both hands does not get it.
    expect(alone?.twoHandedDamage?.bonus).toBe(3);

    c.inventory.push({ itemId: "srd51:item/dagger", quantity: 1, equipped: true });
    expect(deriveSheet(c, index).attacks[0]?.damage?.bonus).toBe(3);

    c.inventory = [{ itemId: "srd51:item/greatsword", quantity: 1, equipped: true }];
    expect(deriveSheet(c, index).attacks[0]?.damage?.bonus).toBe(3);
  });

  it("gives a paladin and a ranger their own style choices from level 2", () => {
    expect(
      deriveSheet(make("paladin", 1, {}), index).choices.some((c) =>
        c.key.includes("paladin-fighting"),
      ),
    ).toBe(false);
    const paladin = deriveSheet(make("paladin", 2, {}), index);
    expect(
      paladin.choices.find((c) => c.key.includes("paladin-fighting-style"))?.options,
    ).toHaveLength(4);
    const ranger = deriveSheet(make("ranger", 2, {}), index);
    expect(
      ranger.choices.find((c) => c.key.includes("ranger-fighting-style"))?.options,
    ).toHaveLength(4);
  });

  it("ignores a style that is not among the options", () => {
    const c = make("fighter", 1, {});
    c.selections[STYLE] = ["srd51:feature/second-wind"];
    const sheet = deriveSheet(c, index);
    expect(sheet.warnings.some((w) => w.code === "invalidChoice")).toBe(true);
    expect(sheet.bonuses).toEqual([]);
  });
});

describe("armor class without armor", () => {
  it("gives a barbarian 10 + Dexterity + Constitution, with a shield too", () => {
    const sheet = deriveSheet(make("barbarian", 1, { dex: 14, con: 16 }), index);
    expect(sheet.armorClass.value).toBe(10 + 2 + 3);
    expect(sheet.bonuses).toContainEqual({
      target: "ac",
      value: 3,
      source: "srd51:feature/barbarian-unarmored-defense",
    });
    expect(
      deriveSheet(make("barbarian", 1, { dex: 14, con: 16 }, ["shield"]), index).armorClass.value,
    ).toBe(17);
  });

  it("stops applying when armor is worn", () => {
    const sheet = deriveSheet(make("barbarian", 1, { dex: 14, con: 16 }, ["chain-mail"]), index);
    expect(sheet.armorClass.value).toBe(16);
  });

  it("gives a monk Wisdom, but not with a shield", () => {
    const monk = make("monk", 1, { dex: 16, wis: 16 });
    expect(deriveSheet(monk, index).armorClass.value).toBe(10 + 3 + 3);
    monk.inventory = [{ itemId: "srd51:item/shield", quantity: 1, equipped: true }];
    expect(deriveSheet(monk, index).armorClass.value).toBe(10 + 3 + 2); // the shield's 2, no Wisdom
  });

  it("gives a draconic sorcerer 13 + Dexterity and a hit point per sorcerer level", () => {
    const c = make("sorcerer", 3, { dex: 14, con: 10 });
    c.classes = [
      { classId: "srd51:class/sorcerer", level: 3, subclassId: "srd51:subclass/draconic" },
    ];
    const sheet = deriveSheet(c, index);
    expect(sheet.armorClass.value).toBe(13 + 2);
    const plain = deriveSheet(
      { ...c, classes: [{ classId: "srd51:class/sorcerer", level: 3 }] },
      index,
    );
    expect(sheet.hitPoints.max).toBe(plain.hitPoints.max + 3);
  });
});

describe("speed", () => {
  it("adds 10 feet with Fast Movement unless heavy armor is worn", () => {
    expect(deriveSheet(make("barbarian", 5, {}), index).speed).toBe(40);
    expect(deriveSheet(make("barbarian", 4, {}), index).speed).toBe(30);
    expect(deriveSheet(make("barbarian", 5, {}, ["plate-armor"]), index).speed).toBe(30);
    expect(deriveSheet(make("barbarian", 5, {}, ["chain-shirt"]), index).speed).toBe(40);
  });

  it("lets a forced speed win", () => {
    const c = make("barbarian", 5, {});
    c.overrides.speed = 25;
    expect(deriveSheet(c, index).speed).toBe(25);
  });
});

describe("Unarmored Movement", () => {
  it("adds speed as the monk grows, without armor or a shield", () => {
    const speed = (level: number, items: string[] = []) =>
      deriveSheet(make("monk", level, {}, items), index).speed;
    expect(speed(1)).toBe(30);
    expect(speed(2)).toBe(40);
    expect(speed(6)).toBe(45);
    expect(speed(10)).toBe(50);
    expect(speed(18)).toBe(60);
    expect(speed(6, ["shield"])).toBe(30);
    expect(speed(6, ["chain-shirt"])).toBe(30);
  });
});

describe("half proficiency", () => {
  it("gives a bard half the proficiency bonus on checks without it, and on initiative", () => {
    const c = make("bard", 2, { dex: 14, wis: 10, str: 10 });
    const sheet = deriveSheet(c, index);
    const stealth = sheet.skills.find((s) => s.id.endsWith("/stealth"));
    expect(stealth?.proficient).toBe(false);
    expect(stealth?.bonus).toBe(2 + 1);
    expect(sheet.initiative).toBe(2 + 1);
    const without = deriveSheet(make("bard", 1, { dex: 14 }), index);
    expect(without.initiative).toBe(2);
  });

  it("gives a champion Remarkable Athlete on Strength, Dexterity and Constitution only", () => {
    const c = make("fighter", 7, { str: 10, dex: 10, wis: 10 });
    c.classes = [
      { classId: "srd51:class/fighter", level: 7, subclassId: "srd51:subclass/champion" },
    ];
    const sheet = deriveSheet(c, index);
    const bonus = (slug: string) => sheet.skills.find((s) => s.id.endsWith(`/${slug}`));
    expect(bonus("stealth")?.bonus).toBe(0 + 2);
    expect(bonus("insight")?.bonus).toBe(0);
  });
});

describe("expertise", () => {
  const PICK = "srd51:feature/rogue-expertise-1/expertise";

  it("doubles the proficiency bonus of a skill the rogue is proficient in", () => {
    const c = make("rogue", 1, { dex: 16 });
    c.selections["srd51:class/rogue/rogue-proficiency-1"] = ["skill:stealth", "skill:perception"];
    c.selections[PICK] = ["stealth", "thieves-tools"];
    const sheet = deriveSheet(c, index);
    expect(sheet.skills.find((s) => s.id.endsWith("/stealth"))?.bonus).toBe(3 + 4);
    expect(sheet.skills.find((s) => s.id.endsWith("/perception"))?.bonus).toBe(0 + 2);
    expect(sheet.warnings).toEqual([]);
  });

  it("warns when the skill is not one the character is proficient in", () => {
    const c = make("rogue", 1, { dex: 16 });
    c.selections[PICK] = ["stealth"];
    const sheet = deriveSheet(c, index);
    expect(sheet.warnings.map((w) => w.code)).toContain("expertiseNeedsProficiency");
    expect(sheet.skills.find((s) => s.id.endsWith("/stealth"))?.bonus).toBe(3);
  });
});

describe("options that grow with the class", () => {
  const INVOCATIONS = "srd51:feature/eldritch-invocations/option";
  const invocation = (name: string) => `srd51:feature/eldritch-invocation-${name}`;

  it("lets a warlock pick as many invocations as the table says", () => {
    expect(
      deriveSheet(make("warlock", 1, {}), index).choices.some((c) => c.key === INVOCATIONS),
    ).toBe(false);
    const two = deriveSheet(make("warlock", 2, {}), index).choices.find(
      (c) => c.key === INVOCATIONS,
    );
    expect(two?.choose).toBe(2);
    expect(two?.options).toHaveLength(32);
    const five = deriveSheet(make("warlock", 10, {}), index).choices.find(
      (c) => c.key === INVOCATIONS,
    );
    expect(five?.choose).toBe(5);
  });

  it("gives the spell an invocation or a pact grants", () => {
    const c = make("warlock", 2, {});
    c.selections[INVOCATIONS] = [invocation("armor-of-shadows"), invocation("mask-of-many-faces")];
    const sheet = deriveSheet(c, index);
    expect(sheet.grantedSpells).toEqual(
      expect.arrayContaining(["srd51:spell/mage-armor", "srd51:spell/disguise-self"]),
    );
    expect(sheet.warnings).toEqual([]);
  });

  it("warns about an invocation that asks for a level or a pact the warlock lacks", () => {
    const c = make("warlock", 2, {});
    c.selections[INVOCATIONS] = [invocation("lifedrinker"), invocation("one-with-shadows")];
    const codes = deriveSheet(c, index).warnings.map((w) => w.code);
    expect(codes).toContain("optionLevel");
    expect(codes).toContain("optionFeature");
  });

  it("gives a sorcerer two metamagic options at level 3 and three at level 10", () => {
    const pick = (level: number) =>
      deriveSheet(make("sorcerer", level, {}), index).choices.find((c) =>
        c.key.includes("metamagic-1"),
      );
    expect(pick(3)?.choose).toBe(2);
    expect(pick(3)?.options).toHaveLength(8);
    expect(pick(10)?.choose).toBe(3);
    expect(pick(2)).toBeUndefined();
  });

  it("offers a warlock the pact boon at level 3", () => {
    const boon = deriveSheet(make("warlock", 3, {}), index).choices.find((c) =>
      c.key.includes("pact-boon"),
    );
    expect(boon?.options).toHaveLength(3);
  });
});
