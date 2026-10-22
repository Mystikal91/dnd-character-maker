import { describe, expect, it } from "vitest";
import type { Effect, Entry } from "../data/schema";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

const gift = (slug: string, effect: Effect): Entry => ({
  id: `test:item/${slug}`,
  kind: "item",
  effects: [effect],
  data: { category: "rings", cost: { amount: 0, unit: "gp" } },
});

const gifts = [
  gift("hex", { type: "weaponAbility", ability: "cha", when: "oneHanded", proficient: true }),
  gift("ready", { type: "weaponAbility", ability: "int", when: "magic" }),
];
const magicSword: Entry = {
  ...(srd51Index.get("srd51:item/longsword") as Entry),
  id: "test:item/magic-sword",
  data: { ...(srd51Index.get("srd51:item/longsword")?.data ?? {}), rarity: "rare" },
};
const index = new Map<string, Entry>([
  ...srd51Index,
  ...gifts.map((e) => [e.id, e] as const),
  [magicSword.id, magicSword],
]);

function attacks(...equipped: string[]) {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/human";
  c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
  c.abilityBase = { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 16 };
  c.inventory = equipped.map((slug) => ({
    itemId: slug.includes(":") ? slug : `test:item/${slug}`,
    quantity: 1,
    equipped: true,
  }));
  return deriveSheet(c, index).attacks;
}

const attackWith = (weapon: string, ...extra: string[]) =>
  attacks(`srd51:item/${weapon}`, ...extra).find((a) => a.itemId === `srd51:item/${weapon}`);

describe("a weapon that uses another ability", () => {
  it("uses Strength or Dexterity when nothing says otherwise", () => {
    expect(attackWith("longsword")?.ability).toBe("str");
  });

  it("uses Charisma for a one-handed weapon the wielder is proficient with", () => {
    const sword = attackWith("longsword", "hex");
    expect(sword?.ability).toBe("cha");
    expect(sword?.abilityFrom).toBe("test:item/hex");
    // Charisma 17 (+3) and the proficiency bonus (+2), damage with the same modifier.
    expect(sword?.attackBonus).toBe(5);
    expect(sword?.damage?.bonus).toBe(3);
  });

  it("leaves a two-handed weapon alone", () => {
    expect(attackWith("greatsword", "hex")?.ability).toBe("str");
  });

  it("applies to a magic weapon only", () => {
    expect(attackWith("longsword", "ready")?.ability).toBe("str");
    const magic = attacks("test:item/magic-sword", "ready")[0];
    expect(magic?.ability).toBe("int");
  });

  it("never lowers the modifier", () => {
    const c = createCharacter("srd51");
    c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
    c.abilityBase = { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    c.inventory = [
      { itemId: "srd51:item/longsword", quantity: 1, equipped: true },
      { itemId: "test:item/hex", quantity: 1, equipped: true },
    ];
    const a = deriveSheet(c, index).attacks[0];
    expect(a?.ability).toBe("str");
    expect(a?.abilityFrom).toBeUndefined();
  });
});
