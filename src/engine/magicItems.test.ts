import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

const item = (
  slug: string,
  effects: Entry["effects"],
  data: Record<string, unknown> = {},
): Entry => ({
  id: `test:item/${slug}`,
  kind: "item",
  effects,
  data: { category: "rings", cost: { amount: 0, unit: "gp" }, rarity: "rare", ...data },
});

const items = [
  item("ring-of-protection", [
    { type: "modifier", target: "ac", value: 1 },
    { type: "modifier", target: "save", value: 1 },
  ]),
  item("ring-of-fire-warding", [{ type: "defense", kind: "resistance", damage: "fire" }]),
  item("gauntlets", [{ type: "abilityFloor", ability: "str", value: 19 }]),
  item("armor-plus-one", [{ type: "modifier", target: "ac", value: 1, when: "wearingArmor" }]),
  item("shield-plus-one", [{ type: "modifier", target: "ac", value: 1, when: "wearingShield" }]),
  item("tome", [{ type: "abilityBonus", ability: "int", value: 2 }]),
  ...["a", "b", "c", "d"].map((n) => item(`attuned-${n}`, [], { attunement: true })),
];
const index = new Map<string, Entry>([...srd51Index, ...items.map((e) => [e.id, e] as const)]);

function make(...equipped: string[]) {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/human";
  c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
  c.abilityBase = { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 };
  c.inventory = equipped.map((slug) => ({
    itemId: slug.includes(":") ? slug : `test:item/${slug}`,
    quantity: 1,
    equipped: true,
  }));
  return c;
}

const sheet = (...equipped: string[]) => deriveSheet(make(...equipped), index);

describe("what equipped items give", () => {
  it("applies a ring's bonus to armor class and to every saving throw, only while equipped", () => {
    const bare = sheet();
    const worn = sheet("ring-of-protection");
    expect(worn.armorClass.value).toBe(bare.armorClass.value + 1);
    for (const ability of ["str", "dex", "con", "int", "wis", "cha"] as const)
      expect(worn.saves[ability].bonus).toBe(bare.saves[ability].bonus + 1);
    const carried = make("ring-of-protection");
    const first = carried.inventory[0];
    if (first) first.equipped = false;
    expect(deriveSheet(carried, index).armorClass.value).toBe(bare.armorClass.value);
  });

  it("lists a resistance an item gives", () => {
    expect(sheet().defenses.resistance).toEqual([]);
    expect(sheet("ring-of-fire-warding").defenses.resistance).toEqual(["fire"]);
  });

  it("raises an ability score to a value without ever lowering it", () => {
    expect(sheet("gauntlets").abilities.str.score).toBe(19);
    const strong = make("gauntlets");
    strong.abilityBase.str = 20;
    expect(deriveSheet(strong, index).abilities.str.score).toBe(21); // 20, and the human's +1
    expect(sheet("gauntlets").abilities.str.bonus).toBe(9);
  });

  it("adds an ability bonus", () => {
    expect(sheet("tome").abilities.int.score).toBe(13); // 10, the human's +1 and the tome's +2
  });

  it("gives a bonus for armor or a shield only while one is worn", () => {
    const base = sheet().armorClass.value;
    expect(sheet("armor-plus-one").armorClass.value).toBe(base);
    expect(sheet("shield-plus-one").armorClass.value).toBe(base);
    const withArmor = sheet("srd51:item/chain-mail", "armor-plus-one").armorClass.value;
    expect(withArmor).toBe(sheet("srd51:item/chain-mail").armorClass.value + 1);
    const withShield = sheet("srd51:item/shield", "shield-plus-one").armorClass.value;
    expect(withShield).toBe(sheet("srd51:item/shield").armorClass.value + 1);
  });

  it("warns when more than three attuned items are equipped", () => {
    const codes = (...slugs: string[]) => sheet(...slugs).warnings.map((w) => w.code);
    expect(codes("attuned-a", "attuned-b", "attuned-c")).not.toContain("attunementTooMany");
    expect(codes("attuned-a", "attuned-b", "attuned-c", "attuned-d")).toContain(
      "attunementTooMany",
    );
  });
});
