import { describe, expect, it } from "vitest";
import type { Effect, Entry } from "../data/schema";
import { srd51Index } from "../test/srd51";
import { type InventoryItem, createCharacter } from "./character";
import { deriveSheet } from "./derive";

const enchantment = (
  slug: string,
  data: Record<string, unknown>,
  effects: Effect[] = [],
): Entry => ({
  id: `test:item/${slug}`,
  kind: "item",
  effects,
  data: { category: "magic-weapons", cost: { amount: 0, unit: "gp" }, enchants: true, ...data },
});

const extra: Entry[] = [
  enchantment("plus-two", { rarity: "rare", enhancement: 2 }),
  enchantment("slayer", { rarity: "rare", enhancement: 1, attunement: true }, [
    { type: "defense", kind: "resistance", damage: "fire" },
  ]),
  {
    id: "test:item/ready",
    kind: "item",
    effects: [{ type: "weaponAbility", ability: "int", when: "magic" }],
    data: { category: "rings", cost: { amount: 0, unit: "gp" } },
  },
];
const index = new Map<string, Entry>([...srd51Index, ...extra.map((e) => [e.id, e] as const)]);

function sheetWith(sword: Partial<InventoryItem>, ...others: string[]) {
  const c = createCharacter("srd51");
  c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
  c.abilityBase = { str: 14, dex: 10, con: 10, int: 18, wis: 10, cha: 10 };
  c.inventory = [
    { itemId: "srd51:item/longsword", quantity: 1, equipped: true, ...sword },
    ...others.map((id) => ({ itemId: id, quantity: 1, equipped: true })),
  ];
  return deriveSheet(c, index);
}

const longsword = (sheet: ReturnType<typeof sheetWith>) =>
  sheet.attacks.find((a) => a.itemId === "srd51:item/longsword");

describe("magic weapons", () => {
  it("is plain without a spell or an enchantment", () => {
    expect(longsword(sheetWith({}))).toMatchObject({ magical: false, enhancement: 0 });
  });

  it("adds a bonus to attack and damage, and counts as magic", () => {
    const plain = longsword(sheetWith({}));
    const spelled = longsword(sheetWith({ bonus: 1 }));
    expect(spelled?.magical).toBe(true);
    expect(spelled?.attackBonus).toBe((plain?.attackBonus ?? 0) + 1);
    expect(spelled?.damage?.bonus).toBe((plain?.damage?.bonus ?? 0) + 1);
  });

  it("counts as magic with just the tick", () => {
    expect(longsword(sheetWith({ magical: true }))).toMatchObject({
      magical: true,
      enhancement: 0,
    });
  });

  it("takes the bonus of an enchantment, and the better of it and a spell", () => {
    const plusTwo = "test:item/plus-two";
    expect(longsword(sheetWith({ enchantment: plusTwo }))?.enhancement).toBe(2);
    expect(longsword(sheetWith({ enchantment: plusTwo, bonus: 3 }))?.enhancement).toBe(3);
    expect(longsword(sheetWith({ enchantment: plusTwo }))?.enchantment).toBe(plusTwo);
  });

  it("gives the effects of the enchantment while the weapon is equipped", () => {
    const slayer = "test:item/slayer";
    expect(sheetWith({ enchantment: slayer }).defenses.resistance).toEqual(["fire"]);
    expect(sheetWith({}).defenses.resistance).toEqual([]);
    expect(sheetWith({ enchantment: slayer, equipped: false }).defenses.resistance).toEqual([]);
  });

  it("counts the attunement of the enchantment", () => {
    const attuned = (id: string) => ({
      itemId: id,
      quantity: 1,
      equipped: true,
    });
    const c = createCharacter("srd51");
    c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
    c.inventory = [
      {
        itemId: "srd51:item/longsword",
        quantity: 1,
        equipped: true,
        enchantment: "test:item/slayer",
      },
      attuned("srd51:item/dagger"),
    ];
    // Only the enchantment needs attunement here: one, far from the limit of three.
    expect(deriveSheet(c, index).warnings.map((w) => w.code)).not.toContain("attunementTooMany");
  });

  it("lets Battle Ready use Intelligence only for a magic weapon", () => {
    expect(longsword(sheetWith({}, "test:item/ready"))?.ability).toBe("str");
    const magic = longsword(sheetWith({ bonus: 1 }, "test:item/ready"));
    expect(magic?.ability).toBe("int");
    // Intelligence 18 (+4) over Strength 14 (+2), and the +1 of the spell.
    expect(magic?.damage?.bonus).toBe(5);
  });
});
