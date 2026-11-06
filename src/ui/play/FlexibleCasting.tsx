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
  const levels = s.spellSlots
    .map((total, i) => ({ level: i + 1, total }))
    .filter((x) => x.total > 0 && slotsLeft(play, x.level, x.total) > 0);

  return (
    <section class="flexible-casting">
      <h4>{ui("play.flexible.title")}</h4>
      <p class="muted">{ui("play.flexible.points", { left, max: pool.max })}</p>
      <div class="flexible-row">
        <small>{ui("play.flexible.make")}</small>
        <span class="flexible-buttons">
          {Object.entries(SLOT_COSTS).map(([key, cost]) => {
            const level = Number(key);
            return (
              <button
                type="button"
                key={level}
                class="card-btn"
                disabled={!canCreateSlot(play, level, pool)}
                title={ui("play.flexible.makeHint", { level, cost })}
                onClick={() => {
                  changePlay((p) => createSlot(p, level, pool));
                  addLog({ label: ui("play.flexible.madeLog", { level, cost }), detail: "" });
                }}
              >
                {level} · {cost}
              </button>
            );
          })}
        </span>
      </div>
      <div class="flexible-row">
        <small>{ui("play.flexible.convert")}</small>
        <span class="flexible-buttons">
          {levels.length === 0 && <span class="muted">{"—"}</span>}
          {levels.map(({ level, total }) => {
            const gain = pointsFromSlot(play, level, pool);
            return (
              <button
                type="button"
                key={level}
                class="card-btn"
                disabled={gain <= 0}
                title={ui("play.flexible.convertHint", { level, gain })}
                onClick={() => {
                  changePlay((p) => convertSlot(p, level, total, pool));
                  addLog({ label: ui("play.flexible.convertedLog", { level, gain }), detail: "" });
                }}
              >
                {level} → +{gain}
              </button>
            );
          })}
        </span>
      </div>
    </section>
  );
}
