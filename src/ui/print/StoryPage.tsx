import { character, content } from "../../app/store";
import type { Content } from "../../content/browser";
import { itemData } from "../../data/items";
import type { Character } from "../../engine/character";
import { type UiKey, ui } from "../../i18n/ui";

const FIELDS = ["age", "height", "weight", "eyes", "skin", "hair"] as const;
const SLOTS = [
  "head",
  "amulet",
  "cloak",
  "armor",
  "hands",
  "ring",
  "ring",
  "belt",
  "boots",
] as const;
const MAGIC_ITEM_LINES = 5;
const BACKPACK_LINES = 18;

/** The equipped items that belong in a given slot, by name. Only armor and hands are known. */
function slotValue(c: Content, ch: Character, slot: (typeof SLOTS)[number]): string {
  const equipped = ch.inventory
    .filter((i) => i.equipped)
    .map((i) => ({ id: i.itemId, data: c.index.get(i.itemId) }))
    .filter((i) => i.data);
  const names = (keep: (data: ReturnType<typeof itemData>) => boolean) =>
    equipped
      .filter((i) => i.data && keep(itemData(i.data)))
      .map((i) => c.name(i.id))
      .join(", ");
  if (slot === "armor") return names((d) => Boolean(d.armor) && d.armor?.category !== "shield");
  if (slot === "hands") return names((d) => Boolean(d.weapon) || d.armor?.category === "shield");
  return "";
}

function Block({ title, className = "" }: { title: string; className?: string }) {
  return (
    <section class={`p-frame p-block ${className}`.trim()}>
      <h3 class="p-h">{title}</h3>
    </section>
  );
}

/** A page of frames to handwrite in, with what the app knows already filled in. */
export function StoryPage() {
  const c = content.value;
  const ch = character.value;
  if (!c) return null;
  const background = ch.choices.background;
  const featureName = background ? c.text(background, "featureName") : undefined;
  const featureDesc = background ? c.text(background, "featureDesc") : undefined;
  const carried = ch.inventory.filter((i) => !i.equipped);

  return (
    <section class="p-page p-story">
      <div class="p-story-top">
        <div class="p-banner">
          <h1>{ch.name || ui("sheet.unnamed")}</h1>
          <small>{ui("sheet.name")}</small>
        </div>
        <div class="p-frame p-block">
          <dl class="p-fields" style="grid-template-columns: repeat(3, 1fr)">
            {FIELDS.map((f) => (
              <div key={f}>
                <dd>{" "}</dd>
                <dt>{ui(`print.field.${f}` as UiKey)}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div class="p-story-grid">
        <div class="col">
          <Block title={ui("print.story.appearance")} className="big" />
        </div>
        <div class="col">
          <Block title={ui("print.story.personality")} className="fill" />
          <Block title={ui("print.story.ideals")} className="fill" />
          <Block title={ui("print.story.bonds")} className="fill" />
          <Block title={ui("print.story.flaws")} className="fill" />
        </div>
        <div class="col">
          <section class="p-frame p-block fill" style="min-height: 42mm">
            <h3 class="p-h">{ui("print.story.background")}</h3>
            {background && <strong>{c.name(background)}</strong>}
            {featureName && (
              <p>
                <em>{featureName}.</em> {featureDesc?.split("\n\n")[0]}
              </p>
            )}
          </section>
          <Block title={ui("print.story.allies")} className="fill" />
          <Block title={ui("print.story.enemies")} className="fill" />
        </div>
      </div>

      <div class="p-story-bottom">
        <section class="p-frame p-block" style="min-height: 88mm">
          <h3 class="p-h">{ui("print.story.additional")}</h3>
        </section>

        <div class="col" style="display: grid; gap: 3mm; align-content: start">
          <section class="p-frame p-block">
            <h3 class="p-h">{ui("print.story.equipment")}</h3>
            {SLOTS.map((slot, i) => (
              <div class="p-slot" key={`${slot}-${i + 1}`}>
                <span class="name">{ui(`print.slot.${slot}` as UiKey)}</span>
                <span class="value">{slotValue(c, ch, slot)}</span>
                <span class="p-pip" title={ui("print.attuned")} />
              </div>
            ))}
            <div class="p-coins">
              {["CP", "SP", "EP", "GP", "PP"].map((coin) => (
                <div key={coin}>
                  <div class="p-coin" />
                  {coin}
                </div>
              ))}
            </div>
          </section>
          <section class="p-frame p-block">
            <h3 class="p-h">{ui("print.story.magicItems")}</h3>
            {Array.from({ length: MAGIC_ITEM_LINES }, (_, i) => (
              <div class="p-slot" style="grid-template-columns: 1fr 4mm" key={`magic-${i + 1}`}>
                <span class="value">{" "}</span>
                <span class="p-pip" title={ui("print.attuned")} />
              </div>
            ))}
          </section>
        </div>

        <section class="p-frame p-block" style="min-height: 88mm">
          <h3 class="p-h">{ui("print.story.backpack")}</h3>
          <ul class="p-lines">
            {carried.map((i) => (
              <li key={i.itemId}>
                {c.name(i.itemId)}
                {i.quantity > 1 && ` ×${i.quantity}`}
              </li>
            ))}
            {Array.from({ length: Math.max(0, BACKPACK_LINES - carried.length) }, (_, i) => (
              <li key={`line-${i + 1}`}>{" "}</li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
