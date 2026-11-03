import { type BoardSlot, equipItem, unequipItem } from "../engine/slots";
import { content, updateCharacter } from "./store";

/** Puts an item of the inventory on, in the given place or the first that fits, taking off what was there. */
export function putOn(itemId: string, slot?: BoardSlot): void {
  const index = content.value?.index;
  if (!index) return;
  updateCharacter((d) => equipItem(d.inventory, index, itemId, slot));
}

/** Takes an item off: it stays in the inventory, in the backpack. */
export function takeOff(itemId: string): void {
  updateCharacter((d) => unequipItem(d.inventory, itemId));
}
