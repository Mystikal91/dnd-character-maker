import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import type { InventoryItem } from "./character";
import { addToInventory, packContents } from "./gear";

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
});
