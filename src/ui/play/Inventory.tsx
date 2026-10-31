import { useItem } from "../../app/play";
import { character, content, updateCharacter } from "../../app/store";
import type { InventoryItem } from "../../engine/character";
import { healingOf, isUsable, itemKind } from "../../engine/gear";
import { ui } from "../../i18n/ui";
import { ItemTag } from "../ItemTag";
import { Panel } from "../sheet/parts";

/** One thing carried: how many, a button to use one up, and a tick for what is worn or held. */
function Row({ item }: { item: InventoryItem }) {
  const c = content.value;
  if (!c) return null;
  const entry = c.index.get(item.itemId);
  const kind = item.custom || !entry ? "custom" : itemKind(entry);
  const name = item.custom?.name ?? c.name(item.itemId);
  // A potion is drunk, not worn; armor, weapons and magic items are switched on and off.
  const wearable = kind === "armor" || kind === "weapon" || (kind === "magic" && !healingOf(entry));

  return (
    <li class="row-between play-item">
      <span class="play-item-name">
        {wearable ? (
          <label class="check-row">
            <input
              type="checkbox"
              checked={item.equipped}
              aria-label={`${ui("form.equipped")}: ${name}`}
              onChange={(e) => {
                const equipped = e.currentTarget.checked;
                updateCharacter((d) => {
                  const found = d.inventory.find((i) => i.itemId === item.itemId);
                  if (found) found.equipped = equipped;
                });
              }}
            />
            <span>{name}</span>
          </label>
        ) : (
          <span>{name}</span>
        )}
        {!item.custom && <ItemTag id={item.itemId} />}
        {item.quantity > 1 && <b class="play-item-qty"> ×{item.quantity}</b>}
      </span>
      {isUsable(kind) && (
        <button
          type="button"
          aria-label={ui("play.useItem", { name })}
          onClick={() => useItem(item.itemId)}
        >
          {ui("play.use")}
        </button>
      )}
    </li>
  );
}

/** What the character carries, at the table: use up potions, arrows and rations; wear and wield. */
export function PlayInventory() {
  const inventory = character.value.inventory;
  if (!content.value || inventory.length === 0) return null;
  return (
    <Panel title={ui("play.inventory")}>
      <ul class="plain">
        {inventory.map((item) => (
          <Row key={item.itemId} item={item} />
        ))}
      </ul>
    </Panel>
  );
}
