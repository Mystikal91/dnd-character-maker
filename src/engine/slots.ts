import type { Entry } from "../data/schema";
import type { InventoryItem } from "./character";

/**
 * Where an item is worn or held, as the data says it (`data.slot`: Aurora's `slot`, written by hand
 * for the SRD) or as its kind says it: armor on the body, a shield in the off hand, a weapon in the
 * hands. An item with none (a potion, a rope) is carried, not worn.
 */
export const ITEM_SLOTS = [
  "head",
  "neck",
  "shoulders",
  "body",
  "arms",
  "hands",
  "waist",
  "feet",
  "ring",
  "oneHand",
  "twoHands",
  "shield",
] as const;
export type ItemSlot = (typeof ITEM_SLOTS)[number];

/** The places of the board, in the order they are shown. A ring has two; the hands are the main and the off one. */
export const BOARD_SLOTS = [
  "head",
  "neck",
  "shoulders",
  "body",
  "arms",
  "hands",
  "waist",
  "feet",
  "ring1",
  "ring2",
  "mainHand",
  "offHand",
] as const;
export type BoardSlot = (typeof BOARD_SLOTS)[number];

/** What each place of the board takes. A two-handed item takes the main hand and shuts the off one. */
const ACCEPTS: Record<BoardSlot, ItemSlot[]> = {
  head: ["head"],
  neck: ["neck"],
  shoulders: ["shoulders"],
  body: ["body"],
  arms: ["arms"],
  hands: ["hands"],
  waist: ["waist"],
  feet: ["feet"],
  ring1: ["ring"],
  ring2: ["ring"],
  mainHand: ["oneHand", "twoHands"],
  offHand: ["oneHand", "shield"],
};

export const acceptedBy = (slot: BoardSlot): readonly ItemSlot[] => ACCEPTS[slot];

const isItemSlot = (value: unknown): value is ItemSlot =>
  typeof value === "string" && (ITEM_SLOTS as readonly string[]).includes(value);

/** The slot an item goes in, or nothing when it is only carried. */
export function itemSlot(entry: Entry | undefined): ItemSlot | undefined {
  if (!entry) return undefined;
  const data = entry.data as {
    slot?: unknown;
    armor?: { category?: string };
    weapon?: { properties?: string[] };
  };
  if (isItemSlot(data.slot)) return data.slot;
  if (data.armor) return data.armor.category === "shield" ? "shield" : "body";
  if (data.weapon)
    return data.weapon.properties?.some((p) => p.endsWith("/two-handed")) ? "twoHands" : "oneHand";
  return undefined;
}

type Index = ReadonlyMap<string, Entry>;

/** Where the equipped items of a character are, as the board shows them. */
export interface Placement {
  /** What is in each place. A two-handed item is in the main hand. */
  slots: Partial<Record<BoardSlot, InventoryItem>>;
  /** The off hand is taken by what the main hand holds in two hands. */
  offHandTaken: boolean;
  /** Equipped, but with no place on the board (an item that is only held or kept about the person). */
  elsewhere: InventoryItem[];
  /** Equipped, with a place that is already taken by something else. */
  crowded: InventoryItem[];
}

const fits = (slot: BoardSlot, kind: ItemSlot) => ACCEPTS[slot].includes(kind);

/**
 * Puts what is equipped in its places. An item keeps the place it was given when that one still
 * fits and is free; the others take the first free place that takes them, in the order of the
 * inventory. What finds no room is `crowded`, what has no place to be is `elsewhere`.
 */
export function placeEquipment(inventory: InventoryItem[], index: Index): Placement {
  const slots: Placement["slots"] = {};
  const elsewhere: InventoryItem[] = [];
  const crowded: InventoryItem[] = [];
  let offHandTaken = false;

  const free = (slot: BoardSlot, kind: ItemSlot) =>
    slots[slot] === undefined && !(slot === "offHand" && offHandTaken) && fits(slot, kind);
  const put = (slot: BoardSlot, kind: ItemSlot, item: InventoryItem) => {
    slots[slot] = item;
    if (kind === "twoHands" && slot === "mainHand") offHandTaken = true;
  };
  /** Whether a place can take the item now: a two-handed one needs the off hand to be free too. */
  const canTake = (slot: BoardSlot, kind: ItemSlot) =>
    free(slot, kind) && (kind !== "twoHands" || slots.offHand === undefined);

  const equipped = inventory.filter((i) => i.equipped);
  const kindOf = (item: InventoryItem) =>
    item.custom ? undefined : itemSlot(index.get(item.itemId));

  const rest: InventoryItem[] = [];
  for (const item of equipped) {
    const kind = kindOf(item);
    if (!kind) {
      elsewhere.push(item);
      continue;
    }
    if (item.slot && canTake(item.slot, kind)) put(item.slot, kind, item);
    else rest.push(item);
  }
  for (const item of rest) {
    const kind = kindOf(item);
    if (!kind) continue;
    const place = BOARD_SLOTS.find((slot) => canTake(slot, kind));
    if (place) put(place, kind, item);
    else crowded.push(item);
  }
  return { slots, offHandTaken, elsewhere, crowded };
}

/** The items that are not equipped and that a place of the board takes. */
export function candidatesFor(
  slot: BoardSlot,
  inventory: InventoryItem[],
  index: Index,
): InventoryItem[] {
  return inventory.filter((item) => {
    if (item.equipped || item.custom) return false;
    const kind = itemSlot(index.get(item.itemId));
    return kind !== undefined && fits(slot, kind);
  });
}

/** The place an item would take if it were put on now: the first free one, or else the first that fits. */
export function naturalSlot(
  item: InventoryItem,
  inventory: InventoryItem[],
  index: Index,
): BoardSlot | undefined {
  const kind = itemSlot(index.get(item.itemId));
  if (!kind) return undefined;
  const { slots, offHandTaken } = placeEquipment(
    inventory.filter((i) => i.equipped && i.itemId !== item.itemId),
    index,
  );
  const fitting = BOARD_SLOTS.filter((slot) => fits(slot, kind));
  const open = fitting.find(
    (slot) =>
      slots[slot] === undefined &&
      !(slot === "offHand" && offHandTaken) &&
      (kind !== "twoHands" || slots.offHand === undefined),
  );
  return open ?? fitting[0];
}

/**
 * Puts an item of the inventory on, in the given place or the natural one, and takes off what was
 * there (a two-handed item takes off what both hands held; anything one-handed or a shield takes
 * off a two-handed item in the main hand). Changes the inventory it is given.
 */
export function equipItem(
  inventory: InventoryItem[],
  index: Index,
  itemId: string,
  slot?: BoardSlot,
): void {
  const item = inventory.find((i) => i.itemId === itemId);
  if (!item) return;
  const kind = item.custom ? undefined : itemSlot(index.get(itemId));
  const target = slot ?? naturalSlot(item, inventory, index);
  if (!kind || !target || !fits(target, kind)) {
    // Something that has no place on the board is only switched on.
    item.equipped = true;
    item.slot = undefined;
    return;
  }
  const others = inventory.filter((i) => i.equipped && i.itemId !== itemId);
  const placed = placeEquipment(others, index);
  const off = (found?: InventoryItem) => {
    if (found) {
      found.equipped = false;
      found.slot = undefined;
    }
  };
  off(placed.slots[target]);
  if (kind === "twoHands") off(placed.slots.offHand);
  // A two-handed item in the main hand shuts the off hand: putting something there takes it off.
  if (target === "offHand" && placed.offHandTaken) off(placed.slots.mainHand);
  item.equipped = true;
  item.slot = target;
}

/** Takes an item off. */
export function unequipItem(inventory: InventoryItem[], itemId: string): void {
  const item = inventory.find((i) => i.itemId === itemId);
  if (!item) return;
  item.equipped = false;
  item.slot = undefined;
}

/** The places that are always on the board: the body and the two hands. The rest show when they have something. */
const ALWAYS: BoardSlot[] = ["body", "mainHand", "offHand"];

/**
 * The places of the board to show: the always ones, those with something in them and those that
 * something carried could fill; all of them when asked.
 */
export function visibleSlots(
  inventory: InventoryItem[],
  index: Index,
  showAll = false,
): BoardSlot[] {
  const { slots } = placeEquipment(inventory, index);
  return BOARD_SLOTS.filter(
    (slot) =>
      showAll ||
      ALWAYS.includes(slot) ||
      slots[slot] !== undefined ||
      candidatesFor(slot, inventory, index).length > 0,
  );
}
