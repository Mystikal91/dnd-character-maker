import { describe, expect, it } from "vitest";
import type { Effect, Entry } from "../data/schema";
import { srd51Index } from "../test/srd51";
import { type InventoryItem, createCharacter } from "./character";
import { createPlayState } from "./character";
import { deriveSheet } from "./derive";
import { longRest, setShillelagh, shortRest } from "./play";

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

/** The attack of a druid with one weapon, with the cantrip Shillelagh on it when `on` is set. */
function druid(item: Partial<InventoryItem> & { itemId: string }, on = false, extra: Entry[] = []) {
  const c = createCharacter("srd51");
  c.classes = [{ classId: "srd51:class/druid", level: 1 }];
  c.abilityBase = { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 };
  c.inventory = [{ quantity: 1, equipped: true, ...item }];
  if (on) c.play.shillelagh = item.itemId;
  const withExtra = new Map<string, Entry>([...index, ...extra.map((e) => [e.id, e] as const)]);
  return deriveSheet(c, withExtra).attacks[0];
}

describe("Shillelagh", () => {
  const staff = "srd51:item/quarterstaff";

  it("changes nothing until it is on the weapon, in Play", () => {
    expect(druid({ itemId: staff })).toMatchObject({
      ability: "str",
      magical: false,
      canShillelagh: true,
    });
  });

  it("makes a quarterstaff magic, with the spellcasting ability and a d8", () => {
    const a = druid({ itemId: staff }, true);
    expect(a).toMatchObject({ ability: "wis", magical: true, shillelagh: true });
    expect(a?.damage?.dice).toBe("1d8");
    // Wisdom 16 (+3) and the proficiency bonus (+2).
    expect(a?.attackBonus).toBe(5);
    expect(a?.damage?.bonus).toBe(3);
  });

  it("makes a club a d8 too, and leaves other weapons alone", () => {
    expect(druid({ itemId: "srd51:item/club" }, true)?.damage?.dice).toBe("1d8");
    const dagger = druid({ itemId: "srd51:item/dagger" }, true);
    expect(dagger).toMatchObject({ ability: "str", magical: false });
    expect(dagger?.shillelagh).toBeUndefined();
    expect(dagger?.canShillelagh).toBeUndefined();
  });

  it("is on one weapon only", () => {
    const c = createCharacter("srd51");
    c.classes = [{ classId: "srd51:class/druid", level: 1 }];
    c.abilityBase = { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 };
    c.inventory = [
      { itemId: "srd51:item/club", quantity: 1, equipped: true },
      { itemId: staff, quantity: 1, equipped: true },
    ];
    c.play.shillelagh = staff;
    const attacks = deriveSheet(c, index).attacks;
    expect(attacks.find((x) => x.itemId === staff)?.shillelagh).toBe(true);
    expect(attacks.find((x) => x.itemId === "srd51:item/club")?.shillelagh).toBeUndefined();
  });

  it("works on a copy of a club that a person made", () => {
    const copy: Entry = {
      id: "hb1:item/oak-club",
      kind: "item",
      effects: [],
      data: {
        category: "weapon",
        cost: { amount: 0, unit: "gp" },
        copyOf: "srd51:item/club",
        weapon: {
          category: "simple",
          kind: "melee",
          damage: { dice: "1d4", type: "bludgeoning" },
          properties: [],
          range: { normal: 5 },
          proficiency: ["weapon:simple-weapons"],
        },
      },
    };
    const a = druid({ itemId: copy.id }, true, [copy]);
    expect(a).toMatchObject({ ability: "wis", magical: true, shillelagh: true });
    expect(a?.damage?.dice).toBe("1d8");
  });

  it("is ended by any rest", () => {
    const play = { ...createPlayState(), shillelagh: staff };
    expect(shortRest(play, "none").shillelagh).toBeUndefined();
    expect(longRest(play, {}).shillelagh).toBeUndefined();
    expect(setShillelagh(createPlayState(), staff).shillelagh).toBe(staff);
    expect(setShillelagh(play, undefined).shillelagh).toBeUndefined();
  });

  it("keeps Strength for a character that casts no spells, and offers nothing to them", () => {
    const c = createCharacter("srd51");
    c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
    c.abilityBase = { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 };
    c.inventory = [{ itemId: "srd51:item/club", quantity: 1, equipped: true }];
    c.play.shillelagh = "srd51:item/club";
    const a = deriveSheet(c, index).attacks[0];
    expect(a?.ability).toBe("str");
    expect(a?.damage?.dice).toBe("1d8");
    expect(a?.canShillelagh).toBeUndefined();
  });
});

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
