import { content } from "../app/store";
import { itemData } from "../data/items";
import { type UiKey, ui } from "../i18n/ui";

/** What kind of armor or weapon an item is ("Light armor", "Martial weapon · Melee"), if it is one. */
export function itemTag(id: string): string | undefined {
  const entry = content.value?.index.get(id);
  if (!entry) return undefined;
  try {
    const data = itemData(entry);
    if (data.armor) return ui(`item.tag.${data.armor.category}` as UiKey);
    if (data.weapon)
      return `${ui(`item.tag.${data.weapon.category}` as UiKey)} · ${ui(`hb.o.${data.weapon.kind}` as UiKey)}`;
  } catch {
    // An item the engine cannot read has no tag.
  }
  return undefined;
}

/** An item's name followed by its kind in brackets, for lists where the name alone says little. */
export function itemLabel(id: string): string {
  const name = content.value?.name(id) ?? id;
  const tag = itemTag(id);
  return tag ? `${name} [${tag}]` : name;
}

/** The kind of an item, as a small note after its name. */
export function ItemTag({ id }: { id: string }) {
  const tag = itemTag(id);
  return tag ? <span class="item-tag">[{tag}]</span> : null;
}
