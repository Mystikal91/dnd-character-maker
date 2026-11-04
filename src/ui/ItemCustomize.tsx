import { canCustomize, openCustomize } from "../app/customizeItem";
import { updateCharacter } from "../app/store";
import type { InventoryItem } from "../engine/character";
import { takesShillelagh } from "../engine/equipment";
import { ui } from "../i18n/ui";

/** The button that opens the window to change a weapon or an armor; nothing for other items. */
export function CustomizeButton({ item }: { item: InventoryItem }) {
  if (!canCustomize(item.itemId)) return null;
  return (
    <button type="button" class="card-btn card-custom" onClick={() => openCustomize(item.itemId)}>
      {ui("item.customize")}
    </button>
  );
}

/** The cantrip Shillelagh on a club or a quarterstaff: it is about this character, not the item. */
export function ShillelaghTick({ item }: { item: InventoryItem }) {
  if (!takesShillelagh(item.itemId)) return null;
  return (
    <div class="shillelagh-tick">
      <label class="check">
        <input
          type="checkbox"
          checked={item.shillelagh === true}
          onChange={(e) => {
            const on = e.currentTarget.checked;
            updateCharacter((d) => {
              const found = d.inventory.find((i) => i.itemId === item.itemId);
              if (found) found.shillelagh = on;
            });
          }}
        />
        <span>{ui("weapon.shillelagh")}</span>
      </label>
      <p class="muted">{ui("weapon.shillelaghHint")}</p>
    </div>
  );
}
