import { content } from "../app/store";
import { itemData } from "../data/items";
import { type UiKey, ui } from "../i18n/ui";
import { distance } from "../i18n/units";

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

const DAMAGE_TYPES = new Set([
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
]);

/** A kind of damage in the language ("tagliente"), or as it is written when it is not a usual one. */
const damageName = (type: string) =>
  DAMAGE_TYPES.has(type) ? ui(`hb.o.${type}` as UiKey).toLowerCase() : type;

/** The numbers of a weapon or armor on one line: damage and properties, or armor class and needs. */
export function itemFacts(id: string): string | undefined {
  const c = content.value;
  const entry = c?.index.get(id);
  if (!c || !entry) return undefined;
  try {
    const data = itemData(entry);
    if (data.weapon) {
      const w = data.weapon;
      const parts: string[] = [];
      if (w.damage)
        parts.push(
          `${w.damage.dice}${data.enhancement ? ` +${data.enhancement}` : ""} ${damageName(w.damage.type)}`.trim(),
        );
      if (w.twoHandedDamage) parts.push(`${ui("sheet.twoHanded")} ${w.twoHandedDamage.dice}`);
      for (const p of w.properties) if (c.index.has(p)) parts.push(c.name(p));
      if (w.kind === "ranged" && w.range.long)
        parts.push(`${distance(w.range.normal)} / ${distance(w.range.long)}`);
      return parts.join(" · ") || undefined;
    }
    if (data.armor) {
      const a = data.armor;
      const parts: string[] = [];
      if (a.category === "shield") parts.push(ui("item.facts.shieldAc", { value: a.base }));
      else {
        let ac = ui("item.facts.ac", { value: a.base });
        if (a.dexBonus)
          ac += ` ${a.maxDexBonus === undefined ? ui("item.facts.dex") : ui("item.facts.dexMax", { max: a.maxDexBonus })}`;
        parts.push(ac);
      }
      if (a.strengthMinimum > 0) parts.push(ui("item.facts.str", { n: a.strengthMinimum }));
      if (a.stealthDisadvantage) parts.push(ui("item.facts.stealth"));
      for (const p of a.properties ?? []) if (c.index.has(p)) parts.push(c.name(p));
      return parts.join(" · ");
    }
  } catch {
    // An item the engine cannot read has no facts.
  }
  return undefined;
}
