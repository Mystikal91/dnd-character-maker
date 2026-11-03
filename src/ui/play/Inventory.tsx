import { character, content } from "../../app/store";
import { ui } from "../../i18n/ui";
import { EquipmentBoard } from "../equipment/EquipmentBoard";
import { Panel } from "../sheet/parts";

/** What the character wears, holds and carries, at the table: the places of the body and the backpack. */
export function PlayInventory() {
  const inventory = character.value.inventory;
  if (!content.value || inventory.length === 0) return null;
  return (
    <Panel title={ui("play.inventory")} className="equipment-panel">
      <EquipmentBoard mode="play" />
    </Panel>
  );
}
