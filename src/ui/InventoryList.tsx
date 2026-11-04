import { isHomebrewId } from "../app/homebrew";
import { character, content, sheet, updateCharacter } from "../app/store";
import { itemData } from "../data/items";
import type { InventoryItem } from "../engine/character";
import { itemKind } from "../engine/gear";
import { itemSlot } from "../engine/slots";
import { type UiKey, ui } from "../i18n/ui";
import { weight } from "../i18n/units";
import { CustomizeButton, ShillelaghTick } from "./ItemCustomize";
import { itemFacts, itemTag } from "./ItemTag";
import { EditPencil } from "./QuickEdit";
import { SlotIcon } from "./equipment/slotIcons";
import { ruleDetail } from "./rules/EntryDetail";
import { Paragraphs } from "./sheet/parts";
import { useHoldRepeat } from "./useHoldRepeat";

const GROUP_ORDER = [
  "homebrew",
  "armor",
  "weapon",
  "gear",
  "tool",
  "mount",
  "magic",
  "custom",
] as const;
type Group = (typeof GROUP_ORDER)[number];

/** Where an item of the inventory is listed: what the person wrote first, then by kind. */
function groupOf(item: InventoryItem): Group {
  if (item.custom) return "custom";
  if (isHomebrewId(item.itemId)) return "homebrew";
  const entry = content.value?.index.get(item.itemId);
  const kind = entry ? itemKind(entry) : "gear";
  return kind === "pack" || kind === "enchantment" ? "gear" : kind;
}

/** The mark at the left of a card: the place of the body it goes to, or the first letter of the name. */
function Badge({ item, name }: { item: InventoryItem; name: string }) {
  const entry = content.value?.index.get(item.itemId);
  const slot = item.custom ? undefined : itemSlot(entry);
  const icon =
    slot === "body" ? (
      <SlotIcon slot="body" />
    ) : slot === "shield" ? (
      <SlotIcon slot="offHand" />
    ) : slot === "oneHand" || slot === "twoHands" ? (
      <SlotIcon slot="mainHand" />
    ) : undefined;
  return (
    <span class="card-badge" aria-hidden="true">
      {icon ?? name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** One thing the character carries, as a card: its name opens the rules, and the buttons are under it. */
function Row({ item, removable }: { item: InventoryItem; removable: boolean }) {
  const hold = useHoldRepeat();
  const c = content.value;
  if (!c) return null;
  const entry = c.index.get(item.itemId);
  const name = item.custom?.name ?? c.name(item.itemId);
  const kind = item.custom || !entry ? "custom" : itemKind(entry);
  const homebrew = !item.custom && isHomebrewId(item.itemId);
  const facts = itemFacts(item.itemId);
  const tag = itemTag(item.itemId);
  const desc = entry ? c.text(item.itemId, "desc") : undefined;
  let data: ReturnType<typeof itemData> | undefined;
  try {
    data = entry ? itemData(entry) : undefined;
  } catch {
    data = undefined;
  }
  const perItem = item.custom?.weight ?? data?.weight;
  const cost = data?.cost;
  const hasInfo = Boolean(item.custom?.note || perItem !== undefined || cost || (!entry && desc));
  const meta = [tag, facts].filter(Boolean).join(" · ");

  const change = (apply: (found: InventoryItem) => void) =>
    updateCharacter((d) => {
      const found = d.inventory.find((i) => i.itemId === item.itemId);
      if (found) apply(found);
    });

  return (
    <li
      class="play-card inv-card"
      data-kind={homebrew ? "homebrew" : kind}
      data-equipped={item.equipped ? "on" : undefined}
    >
      <Badge item={item} name={name} />
      <div class="card-head">
        {entry ? (
          <button
            type="button"
            class="link inv-card-name"
            aria-label={`${ui("inv.info")}: ${name}`}
            onClick={() => {
              ruleDetail.value = item.itemId;
            }}
          >
            {name}
          </button>
        ) : (
          <span class="inv-card-name">{name}</span>
        )}
        {(meta || homebrew) && (
          <span class="card-meta">
            {meta}
            {homebrew && <span class="card-tag">{ui("tag.homebrew")}</span>}
          </span>
        )}
      </div>
      <div class="card-actions">
        <button
          type="button"
          class="card-btn card-equip"
          aria-pressed={item.equipped}
          onClick={() =>
            change((found) => {
              found.equipped = !found.equipped;
            })
          }
        >
          {ui("form.equipped")}
        </button>
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
        <CustomizeButton item={item} />
        {removable && (
          <button
            type="button"
            class="card-x"
            aria-label={`${ui("form.remove")}: ${name}`}
            title={ui("form.remove")}
            onClick={() =>
              updateCharacter((d) => {
                d.inventory = d.inventory.filter((i) => i.itemId !== item.itemId);
              })
            }
          >
            ×
          </button>
        )}
      </div>
      <ShillelaghTick item={item} />
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
        <section key={group} class="card-group">
          <h5 class="card-group-head">{ui(`inv.group.${group}` as UiKey)}</h5>
          <ul class="plain card-list">
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
