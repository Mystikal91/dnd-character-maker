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

export type ItemKind =
  | "armor"
  | "weapon"
  | "pack"
  | "magic"
  | "enchantment"
  | "tool"
  | "mount"
  | "gear";

/** What sort of thing an item is, for listing it: armor, a weapon, a pack, a magic item... */
export function itemKind(entry: Entry): ItemKind {
  const d = entry.data as Record<string, unknown>;
  if (d.enchants === true) return "enchantment";
  if (d.armor) return "armor";
  if (d.weapon) return "weapon";
  if (packContents(entry).length > 0) return "pack";
  if (d.rarity) return "magic";
  if (d.category === "tools") return "tool";
  if (d.category === "mounts-and-vehicles") return "mount";
  return "gear";
}

/** Puts `quantity` of an item in the inventory, adding to what is already there. */
export function addToInventory(inventory: InventoryItem[], itemId: string, quantity = 1): void {
  const existing = inventory.find((i) => i.itemId === itemId);
  if (existing) existing.quantity += quantity;
  else inventory.push({ itemId, quantity, equipped: false });
}
