import { signal } from "@preact/signals";
import { itemData } from "../data/items";
import { copyDraft } from "../homebrew/copy";
import { type Draft, draftFromEntry, newHomebrewPack, saveDraft } from "../homebrew/model";
import { ui } from "../i18n/ui";
import type { UserPackRecord } from "../storage/packs";
import { PERSONAL_SPELLS_PACK } from "./customSpell";
import { character, content, updateCharacter } from "./store";
import { addUserPack, userPacks } from "./userPacks";

/** The id of the item of the inventory whose "Customize" window is open, while it is. */
export const customizing = signal<string | undefined>(undefined);

export const openCustomize = (itemId: string): void => {
  customizing.value = itemId;
};
export const closeCustomize = (): void => {
  customizing.value = undefined;
};

/** Only weapons and armor can be customized. */
export function canCustomize(itemId: string): boolean {
  const entry = content.value?.index.get(itemId);
  if (!entry || entry.kind !== "item") return false;
  try {
    const data = itemData(entry);
    return Boolean(data.weapon ?? data.armor);
  } catch {
    return false;
  }
}

/** What the window needs to open: the form, and the pack the result is saved in. */
export interface CustomizePlan {
  draft: Draft;
  /** The pack, with what it holds now; a new one when the person has no homebrew pack yet. */
  record: UserPackRecord;
  /** The entry that is edited, when the item is homebrew already; otherwise a copy is made. */
  editing?: string;
}

const packOf = (id: string) => id.split(":")[0] ?? "";

/**
 * The form for an item of the inventory. A homebrew item is edited where it is; any other becomes a
 * copy, in the first homebrew pack (not the one of the spells written from characters) or in a new
 * one. The bonus and the magic the old "Magic weapon" box put on the item itself are carried into
 * the form, so that they are not lost.
 */
export function planCustomize(itemId: string): CustomizePlan | undefined {
  const c = content.value;
  const entry = c?.index.get(itemId);
  if (!c || !entry || !canCustomize(itemId)) return undefined;
  const owner = userPacks.value.find((p) => p.origin === "homebrew" && p.id === packOf(itemId));
  let draft: Draft | undefined;
  let record: UserPackRecord;
  if (owner) {
    draft = draftFromEntry(entry, owner.strings, owner.pack.entries);
    record = owner;
  } else {
    draft = copyDraft(
      entry,
      { index: c.index, fields: (i) => c.fields(i), read: (i, f) => c.displayed(i, f) ?? "" },
      (name) => ui("hb.copyName", { name }),
    );
    record =
      userPacks.value.find((p) => p.origin === "homebrew" && p.id !== PERSONAL_SPELLS_PACK) ??
      newHomebrewPack(ui("hb.myPack"));
  }
  if (!draft) return undefined;
  const held = character.value.inventory.find((i) => i.itemId === itemId);
  if (held) {
    const bonus = Math.max(Number(draft.values.enhancement) || 0, held.bonus ?? 0);
    if (draft.kind === "weapon") draft.values.enhancement = String(bonus);
    if (held.magical) draft.values.magical = "true";
  }
  return { draft, record, ...(owner && { editing: itemId }) };
}

/** Resolves when the content has an entry (a pack that was just saved is loaded again in a moment). */
function whenIndexed(id: string): Promise<void> {
  if (content.value?.index.has(id)) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      stop();
      clearTimeout(timer);
      resolve();
    };
    const stop = content.subscribe((c) => {
      if (c?.index.has(id)) queueMicrotask(done);
    });
    const timer = setTimeout(done, 3000);
  });
}

/** What the window saves besides the item: what only this character has done to it. */
export interface CharacterPart {
  shillelagh: boolean;
  /** The id of an enchantment put on the weapon, or empty. */
  enchantment: string;
}

/**
 * Saves the form in the pack and puts the result in the inventory in place of the item. Returns the
 * id of the entry. The bonus and the magic of the old box are in the entry now, so the item is
 * cleared of them.
 */
export async function saveCustomItem(
  from: string,
  plan: CustomizePlan,
  record: UserPackRecord,
  draft: Draft,
  part: CharacterPart,
): Promise<string> {
  const c = content.value;
  const slugs = (kind: string) =>
    [...(c?.index.values() ?? [])]
      .filter((e) => e.kind === kind)
      .map((e) => e.id.split("/")[1] ?? "")
      .filter(Boolean);
  const saved = saveDraft(
    record,
    draft,
    { languages: slugs("language"), skills: slugs("skill") },
    plan.editing,
  );
  await addUserPack(saved.record);
  await whenIndexed(saved.id);
  updateCharacter((d) => {
    const found = d.inventory.find((i) => i.itemId === from);
    if (!found) return;
    found.itemId = saved.id;
    found.bonus = undefined;
    found.magical = undefined;
    found.shillelagh = part.shillelagh ? true : undefined;
    found.enchantment = part.enchantment || undefined;
  });
  return saved.id;
}
