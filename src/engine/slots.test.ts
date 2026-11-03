import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { srd51Index } from "../test/srd51";
import type { InventoryItem } from "./character";
import {
  candidatesFor,
  equipItem,
  itemSlot,
  naturalSlot,
  placeEquipment,
  unequipItem,
} from "./slots";

const magic = (slug: string, slot: string): Entry =>
  ({ id: `test:item/${slug}`, kind: "item", effects: [], data: { slot, rarity: "rare" } }) as Entry;

const index = new Map<string, Entry>([
  ...srd51Index,
  ...["ring-a", "ring-b", "ring-c"].map((s) => [`test:item/${s}`, magic(s, "ring")] as const),
  ["test:item/helm", magic("helm", "head")],
  ["test:item/cloak", magic("cloak", "shoulders")],
  ["test:item/robe", magic("robe", "body")],
  ["test:item/rope", { id: "test:item/rope", kind: "item", effects: [], data: {} } as Entry],
]);

const item = (itemId: string, equipped = false): InventoryItem => ({
  itemId,
  quantity: 1,
  equipped,
});
const ids = (list: InventoryItem[]) => list.map((i) => i.itemId);

describe("where an item goes", () => {
  it("reads it from the data, then from what the item is", () => {
    expect(itemSlot(index.get("test:item/helm"))).toBe("head");
    expect(itemSlot(index.get("srd51:item/chain-mail"))).toBe("body");
    expect(itemSlot(index.get("srd51:item/shield"))).toBe("shield");
    expect(itemSlot(index.get("srd51:item/longsword"))).toBe("oneHand");
    // Versatile is held in one hand; a greatsword takes two.
    expect(itemSlot(index.get("srd51:item/greatsword"))).toBe("twoHands");
    expect(itemSlot(index.get("test:item/rope"))).toBeUndefined();
    expect(itemSlot(undefined)).toBeUndefined();
  });
});

describe("the board", () => {
  it("puts armor on the body, a weapon in the main hand and a shield in the off hand", () => {
    const inventory = [
      item("srd51:item/shield", true),
      item("srd51:item/longsword", true),
      item("srd51:item/chain-mail", true),
    ];
    const { slots } = placeEquipment(inventory, index);
    expect(slots.body?.itemId).toBe("srd51:item/chain-mail");
    expect(slots.mainHand?.itemId).toBe("srd51:item/longsword");
    expect(slots.offHand?.itemId).toBe("srd51:item/shield");
  });

  it("fills the two rings, then has no room for a third", () => {
    const inventory = ["ring-a", "ring-b", "ring-c"].map((s) => item(`test:item/${s}`, true));
    const placed = placeEquipment(inventory, index);
    expect(placed.slots.ring1?.itemId).toBe("test:item/ring-a");
    expect(placed.slots.ring2?.itemId).toBe("test:item/ring-b");
    expect(ids(placed.crowded)).toEqual(["test:item/ring-c"]);
  });

  it("shuts the off hand when the main hand holds a two-handed weapon", () => {
    const inventory = [item("srd51:item/greatsword", true), item("srd51:item/shield", true)];
    const placed = placeEquipment(inventory, index);
    expect(placed.slots.mainHand?.itemId).toBe("srd51:item/greatsword");
    expect(placed.offHandTaken).toBe(true);
    expect(ids(placed.crowded)).toEqual(["srd51:item/shield"]);
  });

  it("keeps the place an item was given, and lists what has none apart", () => {
    const second: InventoryItem = { ...item("test:item/ring-a", true), slot: "ring2" };
    const placed = placeEquipment([second, item("test:item/rope", true)], index);
    expect(placed.slots.ring2?.itemId).toBe("test:item/ring-a");
    expect(placed.slots.ring1).toBeUndefined();
    expect(ids(placed.elsewhere)).toEqual(["test:item/rope"]);
  });

  it("offers what is carried and fits a place", () => {
    const inventory = [
      item("test:item/ring-a"),
      item("test:item/ring-b", true),
      item("srd51:item/longsword"),
      item("test:item/helm"),
    ];
    expect(ids(candidatesFor("ring1", inventory, index))).toEqual(["test:item/ring-a"]);
    expect(ids(candidatesFor("mainHand", inventory, index))).toEqual(["srd51:item/longsword"]);
    expect(ids(candidatesFor("head", inventory, index))).toEqual(["test:item/helm"]);
    expect(candidatesFor("feet", inventory, index)).toEqual([]);
  });
});

describe("putting on and taking off", () => {
  it("takes the first free place, and swaps when there is none", () => {
    const inventory = [item("srd51:item/longsword", true), item("srd51:item/dagger")];
    expect(naturalSlot(inventory[1] as InventoryItem, inventory, index)).toBe("offHand");
    const swap = [item("srd51:item/longsword", true), item("srd51:item/battleaxe")];
    equipItem(swap, index, "srd51:item/battleaxe", "mainHand");
    expect(swap[0]?.equipped).toBe(false);
    expect(swap[1]).toMatchObject({ equipped: true, slot: "mainHand" });
  });

  it("takes off both hands for a two-handed weapon, and the weapon for something in the off hand", () => {
    const hands = [
      item("srd51:item/longsword", true),
      item("srd51:item/shield", true),
      item("srd51:item/greatsword"),
    ];
    equipItem(hands, index, "srd51:item/greatsword");
    expect(hands.map((i) => i.equipped)).toEqual([false, false, true]);

    const big = [item("srd51:item/greatsword", true), item("srd51:item/shield")];
    equipItem(big, index, "srd51:item/shield", "offHand");
    expect(big.map((i) => i.equipped)).toEqual([false, true]);
  });

  it("switches on an item that has no place and takes any off", () => {
    const inventory = [item("test:item/rope")];
    equipItem(inventory, index, "test:item/rope");
    expect(inventory[0]).toMatchObject({ equipped: true });
    unequipItem(inventory, "test:item/rope");
    expect(inventory[0]).toMatchObject({ equipped: false });
    expect(inventory[0]?.slot).toBeUndefined();
  });

  it("does not put a cloak where armor goes", () => {
    const inventory = [item("test:item/cloak"), item("test:item/robe")];
    equipItem(inventory, index, "test:item/cloak", "body");
    // The cloak does not fit the body: it is only switched on, without a place.
    expect(inventory[0]).toMatchObject({ equipped: true });
    expect(inventory[0]?.slot).toBeUndefined();
    expect(placeEquipment(inventory, index).slots.shoulders?.itemId).toBe("test:item/cloak");
  });
});
