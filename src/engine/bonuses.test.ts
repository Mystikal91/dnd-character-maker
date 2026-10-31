import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

const item = (slug: string, effects: Entry["effects"]): Entry => ({
  id: `test:item/${slug}`,
  kind: "item",
  effects,
  data: { category: "rods", cost: { amount: 0, unit: "gp" }, rarity: "rare" },
});

const items = [
  item("staff-plus-two", [
    { type: "modifier", target: "spellAttack", value: 2 },
    { type: "modifier", target: "spellDc", value: 2 },
  ]),
  item("alert", [{ type: "modifier", target: "initiative", value: 5 }]),
  item("proud", [{ type: "modifier", target: "initiative", value: 0, plus: "proficiency" }]),
  item("charming", [{ type: "modifier", target: "ac", value: 0, plus: "cha", when: "unarmored" }]),
  item("fortitude", [{ type: "modifier", target: "hp", value: 40 }]),
];
const index = new Map<string, Entry>([...srd51Index, ...items.map((e) => [e.id, e] as const)]);

function sheetOf(classId: string, ...worn: string[]) {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/human";
  c.classes = [{ classId: `srd51:class/${classId}`, level: 1 }];
  c.abilityBase = { str: 10, dex: 14, con: 12, int: 16, wis: 10, cha: 14 };
  c.inventory = worn.map((slug) => ({ itemId: `test:item/${slug}`, quantity: 1, equipped: true }));
  return deriveSheet(c, index);
}

describe("bonuses to spells, initiative, armor class and hit points", () => {
  it("adds a bonus to the spell attack and the save DC of a caster", () => {
    const bare = sheetOf("wizard");
    const staff = sheetOf("wizard", "staff-plus-two");
    expect(staff.spellcasting?.attackBonus).toBe((bare.spellcasting?.attackBonus ?? 0) + 2);
    expect(staff.spellcasting?.saveDc).toBe((bare.spellcasting?.saveDc ?? 0) + 2);
  });

  it("adds a number, the proficiency bonus or an ability to initiative", () => {
    const bare = sheetOf("fighter");
    expect(sheetOf("fighter", "alert").initiative).toBe(bare.initiative + 5);
    expect(sheetOf("fighter", "proud").initiative).toBe(bare.initiative + bare.proficiencyBonus);
  });

  it("adds the Charisma modifier to armor class only without armor", () => {
    const bare = sheetOf("wizard");
    expect(sheetOf("wizard", "charming").armorClass.value).toBe(bare.armorClass.value + 2);
    expect(sheetOf("fighter", "charming").armorClass.value).toBeGreaterThan(0);
  });

  it("adds flat hit points", () => {
    expect(sheetOf("fighter", "fortitude").hitPoints.max).toBe(
      sheetOf("fighter").hitPoints.max + 40,
    );
  });
});
