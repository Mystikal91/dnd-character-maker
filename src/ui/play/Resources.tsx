import { changePlay } from "../../app/play";
import { character, content, sheet, updateCharacter } from "../../app/store";
import { pactLeft, setPactUsed, setSlotsUsed, slotsLeft } from "../../engine/play";
import { type UiKey, ui } from "../../i18n/ui";
import { SpellcastingStats } from "../sheet/SpellcastingPanel";
import { Panel } from "../sheet/parts";
import { shownFeatures } from "./Features";
import { ResourceControl, recoveryLabel, resourceLabel } from "./ResourceControl";
import { ResourcesIcon } from "./icons";

/** Spell slots as gems to tap: a filled one is available, a hollow one is spent. */
export function Slots() {
  const s = sheet.value;
  const play = character.value.play;
  if (!s || s.spellcasters.length === 0) return null;
  const levels = s.spellSlots
    .map((total, i) => ({ level: i + 1, total }))
    .filter((x) => x.total > 0);

  return (
    <Panel title={ui("sheet.spellcasting")}>
      <SpellcastingStats s={s} />
      <h4>{ui("play.slots")}</h4>
      <p class="muted">{ui("play.slotsHint")}</p>
      <ul class="plain slots-play">
        {levels.map(({ level, total }) => {
          const left = slotsLeft(play, level, total);
          return (
            <li class="row-between" key={level}>
              <span class="slot-level">{ui("sheet.slotLevel", { level })}</span>
              <span class="pips-btns">
                {Array.from({ length: total }, (_, i) => {
                  const available = i < left;
                  return (
                    <button
                      type="button"
                      key={`slot-${level}-${i + 1}`}
                      class={`pip-btn${available ? " on" : ""}`}
                      aria-pressed={available}
                      aria-label={`${ui("sheet.slotLevel", { level })} ${i + 1}`}
                      onClick={() =>
                        changePlay((p) =>
                          setSlotsUsed(
                            p,
                            level,
                            (p.slotsUsed[level - 1] ?? 0) + (available ? 1 : -1),
                            total,
                          ),
                        )
                      }
                    />
                  );
                })}
              </span>
              <span class="muted">{ui("play.slotLeft", { left, total })}</span>
            </li>
          );
        })}
        {s.pactSlots && (
          <li class="row-between">
            <span class="slot-level">{ui("play.pact", { level: s.pactSlots.level })}</span>
            <span class="pips-btns">
              {Array.from({ length: s.pactSlots.count }, (_, i) => {
                const total = s.pactSlots?.count ?? 0;
                const available = i < pactLeft(play, total);
                return (
                  <button
                    type="button"
                    key={`pact-${i + 1}`}
                    class={`pip-btn${available ? " on" : ""}`}
                    aria-pressed={available}
                    aria-label={`${ui("play.pact", { level: s.pactSlots?.level ?? 0 })} ${i + 1}`}
                    onClick={() =>
                      changePlay((p) =>
                        setPactUsed(p, (p.pactUsed ?? 0) + (available ? 1 : -1), total),
                      )
                    }
                  />
                );
              })}
            </span>
            <span class="muted">
              {ui("play.slotLeft", {
                left: pactLeft(play, s.pactSlots.count),
                total: s.pactSlots.count,
              })}
            </span>
          </li>
        )}
      </ul>
    </Panel>
  );
}

const EXTRA_FACTS = new Set(["rageDamage", "sneakAttack", "martialArts"]);

/**
 * Limited-use class features to tick off, and the class numbers that go with them. The uses of a
 * feature that is listed with the features (it has its own card there) are not listed twice.
 */
export function ClassResources() {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s) return null;
  // What the extra damage panel of the rolls covers is not listed twice.
  const facts = s.facts.filter((f) => !EXTRA_FACTS.has(f.kind));
  const listed = new Set(Object.values(shownFeatures(c, s)).flat());
  const resources = s.resources.filter((r) => !(r.entry && listed.has(r.entry)));
  if (resources.length === 0 && facts.length === 0) return null;

  return (
    <Panel title={ui("play.classResources")} className="resources-panel">
      {facts.length > 0 && (
        <ul class="plain class-facts">
          {facts.map((f) => (
            <li key={f.kind}>{ui(`fact.${f.kind}` as UiKey, f.params)}</li>
          ))}
        </ul>
      )}
      {resources.length > 0 && <p class="muted">{ui("play.resourcesHint")}</p>}
      <ul class="plain card-list">
        {resources.map((r) => (
          <li class="play-card res-card" key={r.id}>
            <span class="card-badge" aria-hidden="true">
              <ResourcesIcon />
            </span>
            <div class="card-head">
              <b class="feat-name">{resourceLabel(r)}</b>
              <span class="feat-tags">
                <span class="card-tag">{recoveryLabel(r)}</span>
              </span>
            </div>
            <div class="feat-uses">
              <ResourceControl r={r} />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** The session notes: the same notes as the Story step, written while playing. */
export function PlayNotes() {
  const notes = character.value.story.notes;
  return (
    <Panel title={ui("story.notes")}>
      <textarea
        class="play-notes"
        rows={5}
        aria-label={ui("story.notes")}
        value={notes}
        onInput={(e) =>
          updateCharacter((d) => {
            d.story.notes = e.currentTarget.value;
          })
        }
      />
    </Panel>
  );
}
