import { content, updateCharacter } from "../app/store";
import { itemData } from "../data/items";
import { takesShillelagh } from "../engine/equipment";
import type { InventoryItem } from "../engine/character";
import { ui } from "../i18n/ui";
import { entriesOfKind } from "./build/fields";

/**
 * What makes a weapon magic: a tick (a spell such as Magic Weapon, a ritual), a bonus to attack
 * and damage, and an enchantment from a pack. Shown for the weapons in the inventory.
 */
export function WeaponMagic({ item }: { item: InventoryItem }) {
  const c = content.value;
  const entry = c?.index.get(item.itemId);
  if (!c || !entry || !itemData(entry).weapon) return null;

  const change = (apply: (found: InventoryItem) => void) =>
    updateCharacter((d) => {
      const found = d.inventory.find((i) => i.itemId === item.itemId);
      if (found) apply(found);
    });
  const enchantments = entriesOfKind("item").filter((o) => c.index.get(o.id)?.data.enchants);

  return (
    <details class="weapon-magic">
      <summary>
        {ui("weapon.magic")}
        {(item.magical || item.shillelagh || item.enchantment || (item.bonus ?? 0) > 0) && " ✦"}
      </summary>
      <p class="muted">{ui("weapon.magicHint")}</p>
      <label class="check">
        <input
          type="checkbox"
          checked={item.magical === true}
          onChange={(e) =>
            change((found) => {
              found.magical = e.currentTarget.checked;
            })
          }
        />
        <span>{ui("weapon.magical")}</span>
      </label>
      {takesShillelagh(item.itemId) && (
        <>
          <label class="check">
            <input
              type="checkbox"
              checked={item.shillelagh === true}
              onChange={(e) =>
                change((found) => {
                  found.shillelagh = e.currentTarget.checked;
                })
              }
            />
            <span>{ui("weapon.shillelagh")}</span>
          </label>
          <p class="muted">{ui("weapon.shillelaghHint")}</p>
        </>
      )}
      <label class="field">
        <span>{ui("weapon.bonus")}</span>
        <select
          value={String(item.bonus ?? 0)}
          onChange={(e) =>
            change((found) => {
              found.bonus = Number(e.currentTarget.value);
            })
          }
        >
          {[0, 1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n === 0 ? "—" : `+${n}`}
            </option>
          ))}
        </select>
      </label>
      {enchantments.length > 0 && (
        <label class="field">
          <span>{ui("weapon.enchantment")}</span>
          <select
            value={item.enchantment ?? ""}
            onChange={(e) =>
              change((found) => {
                if (e.currentTarget.value) found.enchantment = e.currentTarget.value;
                else found.enchantment = undefined;
              })
            }
          >
            <option value="">{ui("form.none")}</option>
            {enchantments.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </details>
  );
}
