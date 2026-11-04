import { canCustomize, openCustomize } from "../app/customizeItem";
import type { InventoryItem } from "../engine/character";
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
