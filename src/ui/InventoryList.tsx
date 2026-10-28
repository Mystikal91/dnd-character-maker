import { character, content, sheet, updateCharacter } from "../app/store";
import { itemData } from "../data/items";
import type { InventoryItem } from "../engine/character";
import { itemKind } from "../engine/gear";
import { type UiKey, ui } from "../i18n/ui";
import { weight } from "../i18n/units";
import { ItemTag, itemFacts } from "./ItemTag";
import { EditPencil } from "./QuickEdit";
import { WeaponMagic } from "./WeaponMagic";
import { Paragraphs } from "./sheet/parts";
import { useHoldRepeat } from "./useHoldRepeat";

const GROUP_ORDER = ["armor", "weapon", "gear", "tool", "mount", "magic", "custom"] as const;
type Group = (typeof GROUP_ORDER)[number];

/** Where an item of the inventory is listed. */
function groupOf(item: InventoryItem): Group {
  if (item.custom) return "custom";
  const entry = content.value?.index.get(item.itemId);
  const kind = entry ? itemKind(entry) : "gear";
  return kind === "pack" || kind === "enchantment" ? "gear" : kind;
}

function Row({ item, removable }: { item: InventoryItem; removable: boolean }) {
  const hold = useHoldRepeat();
  const c = content.value;
  if (!c) return null;
  const entry = c.index.get(item.itemId);
  const name = item.custom?.name ?? c.name(item.itemId);
  const facts = itemFacts(item.itemId);
  const desc = entry ? c.text(item.itemId, "desc") : undefined;
  let data: ReturnType<typeof itemData> | undefined;
  try {
    data = entry ? itemData(entry) : undefined;
  } catch {
    data = undefined;
  }
  const perItem = item.custom?.weight ?? data?.weight;
  const cost = data?.cost;
  const hasInfo = Boolean(desc || item.custom?.note || perItem !== undefined || cost);

  const change = (apply: (found: InventoryItem) => void) =>
    updateCharacter((d) => {
      const found = d.inventory.find((i) => i.itemId === item.itemId);
      if (found) apply(found);
    });

  return (
    <li class="inv-row">
      <div class="inv-main">
        <label class="equip-row">
          <input
            type="checkbox"
            checked={item.equipped}
            onChange={(e) =>
              change((found) => {
                found.equipped = e.currentTarget.checked;
              })
            }
          />
          <span class="equip-tag">{ui("form.equipped")}</span>
          <span class="inv-name">
            {name}
            <ItemTag id={item.itemId} />
          </span>
        </label>
        <span class="qty">
          <button
            type="button"
            class="hold"
            aria-label={ui("inv.fewer", { name })}
            disabled={item.quantity <= 1}
            {...hold(() =>
              change((found) => {
                found.quantity = Math.max(1, found.quantity - 1);
              }),
            )}
          >
            −
          </button>
          <output aria-label={ui("inv.quantity", { name })}>{item.quantity}</output>
          <button
            type="button"
            class="hold"
            aria-label={ui("inv.more", { name })}
            {...hold(() =>
              change((found) => {
                found.quantity += 1;
              }),
            )}
          >
            +
          </button>
        </span>
        {removable && (
          <button
            type="button"
            class="link"
            onClick={() =>
              updateCharacter((d) => {
                d.inventory = d.inventory.filter((i) => i.itemId !== item.itemId);
              })
            }
          >
            {ui("form.remove")}
          </button>
        )}
      </div>
      {facts && <p class="inv-facts muted">{facts}</p>}
      {hasInfo && (
        <details class="inv-info">
          <summary>{ui("inv.info")}</summary>
          {entry && <EditPencil id={item.itemId} />}
          <Paragraphs text={desc} />
          {item.custom?.note && <p>{item.custom.note}</p>}
          <dl class="pairs">
            {perItem !== undefined && (
              <>
                <dt>{ui("inv.weight")}</dt>
                <dd>{weight(perItem)}</dd>
              </>
            )}
            {cost && (
              <>
                <dt>{ui("inv.cost")}</dt>
                <dd>
                  {cost.amount} {cost.unit}
                </dd>
              </>
            )}
          </dl>
        </details>
      )}
      <WeaponMagic item={item} />
    </li>
  );
}

/** What the character carries, in groups, with how many of each and what is worn or wielded. */
export function InventoryList({ removable }: { removable: boolean }) {
  const inventory = character.value.inventory;
  if (!content.value || inventory.length === 0) return null;
  const groups = GROUP_ORDER.map((group) => ({
    group,
    items: inventory.filter((i) => groupOf(i) === group),
  })).filter((g) => g.items.length > 0);
  return (
    <div class="inventory-groups">
      {groups.map(({ group, items }) => (
        <section key={group}>
          <h5>{ui(`inv.group.${group}` as UiKey)}</h5>
          <ul class="equip-list">
            {items.map((item) => (
              <Row key={item.itemId} item={item} removable={removable} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** How much the character carries of how much they can. */
export function LoadLine() {
  const s = sheet.value;
  if (!s) return null;
  return (
    <p class="muted">
      {ui("sheet.load", { carried: weight(s.load.carried), capacity: weight(s.load.capacity) })}
    </p>
  );
}
