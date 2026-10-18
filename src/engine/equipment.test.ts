import { describe, expect, it } from "vitest";
import { srd51Index as index } from "../test/srd51";
import { type Character, createCharacter } from "./character";
import { deriveSheet } from "./derive";

function withItems(
  classId: string,
  scores: Partial<Character["abilityBase"]>,
  items: [string, boolean?][],
) {
  const c = createCharacter("srd51");
  c.classes = [{ classId: `srd51:class/${classId}`, level: 1 }];
  c.abilityBase = { ...c.abilityBase, ...scores };
  c.inventory = items.map(([name, equipped = true]) => ({
    itemId: `srd51:item/${name}`,
    quantity: 1,
    equipped,
  }));
  return c;
}

describe("armor class", () => {
  it("adds chain mail and a shield for a proficient fighter", () => {
    const sheet = deriveSheet(
      withItems("fighter", { str: 16, dex: 14 }, [["chain-mail"], ["shield"]]),
      index,
    );
    expect(sheet.armorClass.value).toBe(18);
    expect(sheet.armorClass.stealthDisadvantage).toBe(true);
    expect(sheet.armorClass.parts).toEqual([
      { source: "armor", value: 16 },
      { source: "shield", value: 2 },
    ]);
    expect(sheet.warnings).toEqual([]);
  });

  it("uses 10 + Dexterity without armor, and full Dexterity with light armor", () => {
    expect(deriveSheet(withItems("rogue", { dex: 16 }, []), index).armorClass.value).toBe(13);
    expect(
      deriveSheet(withItems("rogue", { dex: 16 }, [["leather-armor"]]), index).armorClass.value,
    ).toBe(14);
  });

  it("caps the Dexterity bonus of medium armor at +2", () => {
    const sheet = deriveSheet(withItems("cleric", { dex: 18 }, [["breastplate"]]), index);
    expect(sheet.armorClass.value).toBe(16);
  });

  it("ignores unequipped armor", () => {
    const sheet = deriveSheet(withItems("fighter", { dex: 10 }, [["chain-mail", false]]), index);
    expect(sheet.armorClass.value).toBe(10);
  });

  it("warns, without blocking, about missing proficiency, strength and double armor", () => {
    const c = withItems("wizard", { str: 8 }, [["chain-mail"], ["plate-armor"]]);
    const sheet = deriveSheet(c, index);
    expect(sheet.warnings).toEqual(
      expect.arrayContaining([
        { code: "multipleArmor", params: {} },
        { code: "strengthMinimum", params: { item: "srd51:item/chain-mail", minimum: 13 } },
        { code: "notProficient", params: { item: "srd51:item/chain-mail" } },
      ]),
    );
    expect(sheet.armorClass.value).toBe(16);
  });

  it("lets a Free edit override win", () => {
    const c = withItems("fighter", {}, [["chain-mail"]]);
    c.overrides.ac = 25;
    expect(deriveSheet(c, index).armorClass).toMatchObject({ value: 25, overridden: true });
  });
});

describe("attacks", () => {
  it("derives a proficient longsword attack with a versatile two-handed alternative", () => {
    const sheet = deriveSheet(withItems("fighter", { str: 16 }, [["longsword"]]), index);
    expect(sheet.attacks).toEqual([
      {
        itemId: "srd51:item/longsword",
        ability: "str",
        attackBonus: 5,
        proficient: true,
        damage: { dice: "1d8", bonus: 3, type: "slashing" },
        twoHandedDamage: { dice: "1d10", bonus: 3, type: "slashing" },
        properties: ["srd51:property/versatile"],
        range: { normal: 5 },
      },
    ]);
  });

  it("uses the better of Strength and Dexterity for finesse weapons", () => {
    const [attack] = deriveSheet(
      withItems("rogue", { str: 10, dex: 16 }, [["rapier"]]),
      index,
    ).attacks;
    expect(attack).toMatchObject({ ability: "dex", attackBonus: 5, damage: { bonus: 3 } });
  });

  it("uses Dexterity for ranged weapons and drops proficiency when not proficient", () => {
    const [bow] = deriveSheet(
      withItems("ranger", { str: 8, dex: 16 }, [["longbow"]]),
      index,
    ).attacks;
    expect(bow).toMatchObject({
      ability: "dex",
      attackBonus: 5,
      range: { normal: 150, long: 600 },
    });
    const [wizardBow] = deriveSheet(withItems("wizard", { dex: 16 }, [["longbow"]]), index).attacks;
    expect(wizardBow).toMatchObject({ proficient: false, attackBonus: 3 });
  });

  it("only lists equipped weapons", () => {
    const sheet = deriveSheet(withItems("fighter", {}, [["longsword", false], ["dagger"]]), index);
    expect(sheet.attacks.map((a) => a.itemId)).toEqual(["srd51:item/dagger"]);
  });
});

describe("load", () => {
  it("sums weight and derives capacity from Strength", () => {
    const sheet = deriveSheet(
      withItems("rogue", { str: 10 }, [["leather-armor"], ["rapier", false]]),
      index,
    );
    expect(sheet.load).toEqual({ carried: 12, capacity: 150 });
  });

  it("warns about unknown items", () => {
    const c = withItems("fighter", {}, []);
    c.inventory.push({ itemId: "custom:item/mystery", quantity: 1, equipped: false });
    expect(deriveSheet(c, index).warnings).toContainEqual({
      code: "unknownEntry",
      params: { id: "custom:item/mystery" },
    });
  });
});
