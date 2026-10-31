import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import type { InventoryItem } from "./character";
import {
  addStartingItems,
  addToInventory,
  healingOf,
  isUsable,
  packContents,
  useOne,
} from "./gear";

const entry = (id: string) => {
  const found = srd51Index.get(id);
  if (!found) throw new Error(id);
  return found;
};

describe("equipment packs", () => {
  const packs = [...srd51Index.values()].filter((e) => packContents(e).length > 0);

  it("are the seven packs of the rules, each holding items the app knows", () => {
    expect(packs.map((p) => p.id).sort()).toEqual([
      "srd51:item/burglars-pack",
      "srd51:item/diplomats-pack",
      "srd51:item/dungeoneers-pack",
      "srd51:item/entertainers-pack",
      "srd51:item/explorers-pack",
      "srd51:item/priests-pack",
      "srd51:item/scholars-pack",
    ]);
    for (const pack of packs)
      for (const part of packContents(pack)) {
        expect(srd51Index.has(part.item), `${pack.id} holds ${part.item}`).toBe(true);
        expect(part.quantity).toBeGreaterThan(0);
      }
  });

  it("have nothing to give when the item is not a pack", () => {
    const sword = srd51Index.get("srd51:item/longsword");
    expect(sword && packContents(sword)).toEqual([]);
  });
});

describe("adding to the inventory", () => {
  it("adds to what is already there and starts a new line for the rest", () => {
    const inventory: InventoryItem[] = [
      { itemId: "srd51:item/rope-hempen-50-feet", quantity: 1, equipped: false },
    ];
    addToInventory(inventory, "srd51:item/rope-hempen-50-feet", 2);
    addToInventory(inventory, "srd51:item/backpack");
    expect(inventory).toEqual([
      { itemId: "srd51:item/rope-hempen-50-feet", quantity: 3, equipped: false },
      { itemId: "srd51:item/backpack", quantity: 1, equipped: false },
    ]);
  });

  it("uses up one at a time, and the line goes with the last one", () => {
    const inventory: InventoryItem[] = [
      { itemId: "srd51:item/arrow", quantity: 2, equipped: false },
    ];
    expect(useOne(inventory, "srd51:item/arrow")).toBe(true);
    expect(inventory[0]?.quantity).toBe(1);
    expect(useOne(inventory, "srd51:item/arrow")).toBe(true);
    expect(inventory).toEqual([]);
    expect(useOne(inventory, "srd51:item/arrow")).toBe(false);
  });

  it("tells what can be used and what a potion heals", () => {
    expect(isUsable("gear")).toBe(true);
    expect(isUsable("magic")).toBe(true);
    expect(isUsable("weapon")).toBe(false);
    expect(isUsable("armor")).toBe(false);
    const potion = { ...entry("srd51:item/arrow"), data: { use: { heal: "2d4+2" } } };
    expect(healingOf(potion)).toBe("2d4+2");
    expect(healingOf(entry("srd51:item/arrow"))).toBeUndefined();
  });

  it("opens a pack when adding what a class or background hands out", () => {
    const inventory: InventoryItem[] = [];
    addStartingItems(inventory, srd51Index, [
      { item: "srd51:item/explorers-pack", quantity: 1 },
      { item: "srd51:item/javelin", quantity: 4 },
    ]);
    expect(inventory.some((i) => i.itemId === "srd51:item/explorers-pack")).toBe(false);
    expect(inventory.some((i) => i.itemId === "srd51:item/backpack")).toBe(true);
    expect(inventory.find((i) => i.itemId === "srd51:item/javelin")?.quantity).toBe(4);
  });
});
