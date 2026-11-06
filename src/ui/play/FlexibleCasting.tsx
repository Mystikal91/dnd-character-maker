import { addLog, changePlay } from "../../app/play";
import { character, sheet } from "../../app/store";
import {
  SLOT_COSTS,
  canCreateSlot,
  convertSlot,
  createSlot,
  pointsFromSlot,
  resourceLeft,
  slotsLeft,
} from "../../engine/play";
import { ui } from "../../i18n/ui";

/** A button of the grid: the level of the slot on top, what it costs or gives below. */
function Tile({
  level,
  amount,
  hint,
  disabled,
  onClick,
}: {
  level: number;
  amount: string;
  hint: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" class="flexible-tile" disabled={disabled} title={hint} onClick={onClick}>
      <small>{ui("sheet.slotLevel", { level })}</small>
      <b>{amount}</b>
    </button>
  );
}

/**
 * A sorcerer's Flexible Casting: make a spell slot from sorcery points (up to the 5th level) or
 * spend a slot to gain points. Made slots join the others until a long rest. Only for a character
 * that has the sorcery points and the feature.
 */
export function FlexibleCasting() {
  const s = sheet.value;
  const play = character.value.play;
  const pool = s?.resources.find((r) => r.kind === "sorceryPoints");
  if (!s || !pool) return null;
  if (!s.features.some((f) => f.includes("/flexible-casting"))) return null;
  const left = resourceLeft(play, pool.id, pool.max);
  const unit = ui("play.flexible.pt");
  // Only the levels the character has a slot of, and one left to spend.
  const levels = s.spellSlots
    .map((total, i) => ({ level: i + 1, total }))
    .filter((x) => x.total > 0 && slotsLeft(play, x.level, x.total) > 0);

  return (
    <section class="flexible-casting">
      <header class="flexible-head">
        <h4>{ui("play.flexible.title")}</h4>
        <span class="flexible-points" title={ui("play.flexible.points", { left, max: pool.max })}>
          <b>{left}</b>
          <small>
            /{pool.max} {unit}
          </small>
        </span>
      </header>

      <div class="flexible-group">
        <h5>{ui("play.flexible.make")}</h5>
        <div class="flexible-grid">
          {Object.entries(SLOT_COSTS).map(([key, cost]) => {
            const level = Number(key);
            return (
              <Tile
                key={level}
                level={level}
                amount={`−${cost} ${unit}`}
                hint={ui("play.flexible.makeHint", { level, cost })}
                disabled={!canCreateSlot(play, level, pool)}
                onClick={() => {
                  changePlay((p) => createSlot(p, level, pool));
                  addLog({ label: ui("play.flexible.madeLog", { level, cost }), detail: "" });
                }}
              />
            );
          })}
        </div>
      </div>

      <div class="flexible-group">
        <h5>{ui("play.flexible.convert")}</h5>
        {left >= pool.max ? (
          <p class="muted">{ui("play.flexible.full")}</p>
        ) : levels.length === 0 ? (
          <p class="muted">{ui("play.flexible.noSlots")}</p>
        ) : (
          <div class="flexible-grid">
            {levels.map(({ level, total }) => {
              const gain = pointsFromSlot(play, level, pool);
              return (
                <Tile
                  key={level}
                  level={level}
                  amount={`+${gain} ${unit}`}
                  hint={ui("play.flexible.convertHint", { level, gain })}
                  disabled={gain <= 0}
                  onClick={() => {
                    changePlay((p) => convertSlot(p, level, total, pool));
                    addLog({
                      label: ui("play.flexible.convertedLog", { level, gain }),
                      detail: "",
                    });
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
