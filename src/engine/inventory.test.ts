import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { parseCharacter } from "./characterSchema";
import { deriveSheet } from "./derive";
import { itemKind } from "./gear";

const kindOf = (id: string) => {
  const entry = srd51Index.get(id);
  if (!entry) throw new Error(`missing ${id}`);
  return itemKind(entry);
};

describe("the kind of an item", () => {
  it("sorts the items of the rules for the lists", () => {
    expect(kindOf("srd51:item/longsword")).toBe("weapon");
    expect(kindOf("srd51:item/chain-mail")).toBe("armor");
    expect(kindOf("srd51:item/shield")).toBe("armor");
    expect(kindOf("srd51:item/burglars-pack")).toBe("pack");
    expect(kindOf("srd51:item/backpack")).toBe("gear");
  });

  it("knows tools and mounts from their category", () => {
    const tools = [...srd51Index.values()].filter((e) => e.data.category === "tools");
    const mounts = [...srd51Index.values()].filter(
      (e) => e.data.category === "mounts-and-vehicles",
    );
    expect(tools.length).toBeGreaterThan(0);
    expect(mounts.length).toBeGreaterThan(0);
    expect(tools.every((e) => itemKind(e) === "tool")).toBe(true);
    expect(mounts.every((e) => itemKind(e) === "mount")).toBe(true);
  });

  it("tells magic items and enchantments apart", () => {
    const base = { kind: "item" as const, effects: [] };
    const magic: Entry = {
      ...base,
      id: "t:item/ring",
      data: { category: "rings", rarity: "rare" },
    };
    const enchant: Entry = {
      ...base,
      id: "t:item/plus",
      data: { category: "magic-weapons", rarity: "rare", enchants: true },
    };
    expect(itemKind(magic)).toBe("magic");
    expect(itemKind(enchant)).toBe("enchantment");
  });
});

describe("an item of the player's own", () => {
  const withCustom = () => {
    const c = createCharacter("srd51");
    c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
    c.inventory = [
      {
        itemId: "custom:item/abc",
        quantity: 3,
        equipped: false,
        custom: { name: "Old coin", weight: 0.5, note: "Found in the crypt" },
      },
    ];
    return c;
  };

  it("weighs what the player said, per item, with no warning", () => {
    const sheet = deriveSheet(withCustom(), srd51Index);
    expect(sheet.load.carried).toBeCloseTo(1.5);
    expect(sheet.warnings.map((w) => w.code)).not.toContain("unknownEntry");
  });

  it("is kept when the character is saved and read back", () => {
    const c = withCustom();
    const back = parseCharacter(JSON.parse(JSON.stringify(c)));
    expect(back.inventory[0]?.custom).toEqual({
      name: "Old coin",
      weight: 0.5,
      note: "Found in the crypt",
    });
  });

  it("an unknown item without a name still warns", () => {
    const c = withCustom();
    c.inventory = [{ itemId: "srd51:item/not-a-thing", quantity: 1, equipped: false }];
    expect(deriveSheet(c, srd51Index).warnings.map((w) => w.code)).toContain("unknownEntry");
  });
});
