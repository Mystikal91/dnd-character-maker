import type { Entry } from "../data/schema";
import type { InventoryItem } from "./character";

/** What an equipment pack (a burglar's pack, an explorer's pack...) holds. Empty for any other item. */
export function packContents(entry: Entry): { item: string; quantity: number }[] {
  const gear = entry.data.gear as
    | { contents?: { item?: unknown; quantity?: unknown }[] }
    | undefined;
  return (gear?.contents ?? []).flatMap((c) =>
    typeof c.item === "string" && typeof c.quantity === "number"
      ? [{ item: c.item, quantity: c.quantity }]
      : [],
  );
}

/** Puts `quantity` of an item in the inventory, adding to what is already there. */
export function addToInventory(inventory: InventoryItem[], itemId: string, quantity = 1): void {
  const existing = inventory.find((i) => i.itemId === itemId);
  if (existing) existing.quantity += quantity;
  else inventory.push({ itemId, quantity, equipped: false });
}
