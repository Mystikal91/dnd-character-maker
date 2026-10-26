import { addLog, changePlay, concentrationAlert, rollCheck } from "../../app/play";
import { character, content, sheet, updateCharacter } from "../../app/store";
import {
  castSpell,
  endConcentration,
  pactLeft,
  resourceLeft,
  setPactUsed,
  setResourceUsed,
  setSlotsUsed,
  slotsLeft,
  startConcentration,
  toggleCondition,
} from "../../engine/play";
import type { ClassResource } from "../../engine/resources";
import { type UiKey, signed, ui } from "../../i18n/ui";
import { Panel, RulesText } from "../sheet/parts";
import { collectSpellRows } from "../spellRows";
import { SpellInfoButton } from "../spells/SpellInfo";

/** Spell slots as gems to tap: a filled one is available, a hollow one is spent. */
export function Slots() {
  const s = sheet.value;
  const play = character.value.play;
  if (!s || s.spellcasters.length === 0) return null;
  const levels = s.spellSlots
    .map((total, i) => ({ level: i + 1, total }))
    .filter((x) => x.total > 0);

  return (
    <Panel title={ui("play.slots")}>
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

/** Limited-use class features to tick off, and the class numbers that go with them. */
export function ClassResources() {
  const s = sheet.value;
  const play = character.value.play;
  // What the extra damage panel of the rolls covers is not listed twice.
  const facts = s?.facts.filter((f) => !EXTRA_FACTS.has(f.kind)) ?? [];
  if (!s || (s.resources.length === 0 && facts.length === 0)) return null;

  const label = (r: ClassResource) =>
    r.name ?? ui(`resource.${r.kind}` as UiKey, { level: r.level ?? 0 });
  const spend = (r: ClassResource, change: number) =>
    changePlay((p) => setResourceUsed(p, r.id, (p.resourcesUsed?.[r.id] ?? 0) + change, r.max));

  return (
    <Panel title={ui("play.classResources")}>
      {facts.length > 0 && (
        <ul class="plain class-facts">
          {facts.map((f) => (
            <li key={f.kind}>{ui(`fact.${f.kind}` as UiKey, f.params)}</li>
          ))}
        </ul>
      )}
      {s.resources.length > 0 && <p class="muted">{ui("play.resourcesHint")}</p>}
      <ul class="plain slots-play">
        {s.resources.map((r) => {
          const left = resourceLeft(play, r.id, r.max);
          return (
            <li class="row-between" key={r.id}>
              <span class="slot-level">
                {label(r)}
                <small class="muted">
                  {" "}
                  · {ui(r.recovery === "short" ? "play.recoverShort" : "play.recoverLong")}
                </small>
              </span>
              {r.unlimited ? (
                <span class="muted">{ui("play.unlimited")}</span>
              ) : r.pool ? (
                <span class="counter">
                  <button
                    type="button"
                    class="secondary"
                    aria-label={`${label(r)} −`}
                    disabled={left === 0}
                    onClick={() => spend(r, 1)}
                  >
                    −
                  </button>
                  <b>{ui("play.slotLeft", { left, total: r.max })}</b>
                  <button
                    type="button"
                    class="secondary"
                    aria-label={`${label(r)} +`}
                    disabled={left === r.max}
                    onClick={() => spend(r, -1)}
                  >
                    +
                  </button>
                </span>
              ) : (
                <>
                  <span class="pips-btns">
                    {Array.from({ length: r.max }, (_, i) => {
                      const available = i < left;
                      return (
                        <button
                          type="button"
                          key={`${r.id}-${i + 1}`}
                          class={`pip-btn${available ? " on" : ""}`}
                          aria-pressed={available}
                          aria-label={`${label(r)} ${i + 1}`}
                          onClick={() => spend(r, available ? 1 : -1)}
                        />
                      );
                    })}
                  </span>
                  <span class="muted">{ui("play.slotLeft", { left, total: r.max })}</span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** The spells the character can cast, grouped by level, each with its details one tap away. */
export function PlaySpells() {
  const c = content.value;
  const s = sheet.value;
  const play = character.value.play;
  if (!c || !s) return null;
  const rows = collectSpellRows(c, s);
  if (rows.length === 0) return null;
  const levels = [...new Set(rows.map((r) => r.level))];
  const concentrating = play.concentration;
  const alert = concentrationAlert.value;
  const conSave = s.saves.con.bonus;

  return (
    <Panel title={ui("play.spells")}>
      {concentrating && (
        <div class="concentration" aria-live="polite">
          <b>{ui("play.concentrating", { spell: c.name(concentrating) })}</b>
          {alert !== undefined && (
            <p class="note">
              {ui("play.concentrationCheck", { dc: alert })}{" "}
              <button
                type="button"
                class="roll-btn"
                onClick={() =>
                  rollCheck(`${c.name(concentrating)} - ${ui("play.concentrationSave")}`, conSave)
                }
              >
                <span>{ui("play.concentrationRoll")}</span>
                <b>{signed(conSave)}</b>
              </button>
            </p>
          )}
          <button
            type="button"
            class="secondary"
            onClick={() => {
              concentrationAlert.value = undefined;
              changePlay((p) => endConcentration(p));
            }}
          >
            {ui("play.concentrationEnd")}
          </button>
        </div>
      )}
      {levels.map((level) => (
        <div key={level}>
          <h4>{level === 0 ? ui("spells.cantrips") : ui("spells.level", { level })}</h4>
          <ul class="plain spell-names">
            {rows
              .filter((r) => r.level === level)
              .map((row) => (
                <li key={row.id}>
                  {c.name(row.id)}
                  <SpellInfoButton id={row.id} />
                  {row.level > 0 && (
                    <button
                      type="button"
                      class="chip"
                      onClick={() => {
                        const cast = castSpell(play, row.level, s.spellSlots, s.pactSlots);
                        const name = c.name(row.id);
                        if (!cast) {
                          addLog({ label: name, detail: ui("play.noSlot") });
                          return;
                        }
                        changePlay(() => cast.play);
                        addLog({
                          label: name,
                          detail: ui(
                            cast.slot.kind === "pact" ? "play.castPact" : "play.castSlot",
                            {
                              level: cast.slot.level,
                            },
                          ),
                        });
                      }}
                    >
                      {ui("play.cast")}
                    </button>
                  )}
                  {c.index.get(row.id)?.data.concentration === true && (
                    <button
                      type="button"
                      class={`chip${concentrating === row.id ? " on" : ""}`}
                      aria-pressed={concentrating === row.id}
                      onClick={() => {
                        concentrationAlert.value = undefined;
                        changePlay((p) =>
                          concentrating === row.id
                            ? endConcentration(p)
                            : startConcentration(p, row.id),
                        );
                      }}
                    >
                      {ui("play.concentrate")}
                    </button>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
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

/**
 * The conditions of the rules: the ones in force first, each a button that removes it with its
 * rules under it; the list of all of them stays folded until a new one is wanted.
 */
export function Conditions() {
  const c = content.value;
  const play = character.value.play;
  if (!c) return null;
  const conditions = [...c.index.values()]
    .filter((e) => e.kind === "condition")
    .sort((a, b) => c.name(a.id).localeCompare(c.name(b.id)));
  const active = conditions.filter((e) => play.conditions.includes(e.id));
  const chip = (e: (typeof conditions)[number]) => {
    const on = play.conditions.includes(e.id);
    return (
      <button
        type="button"
        key={e.id}
        class={`chip${on ? " on" : ""}`}
        aria-pressed={on}
        onClick={() => changePlay((p) => toggleCondition(p, e.id))}
      >
        {c.name(e.id)}
      </button>
    );
  };

  return (
    <Panel title={ui("play.conditions")}>
      {active.length > 0 && <div class="chips">{active.map(chip)}</div>}
      {active.map((e) => (
        <RulesText key={e.id} id={e.id} name={c.name(e.id)} text={c.text(e.id, "desc")} />
      ))}
      <details class="add-condition" open={active.length === 0}>
        <summary>{ui("play.addCondition")}</summary>
        <p class="muted">{ui("play.conditionsHint")}</p>
        <div class="chips">
          {conditions.filter((e) => !play.conditions.includes(e.id)).map(chip)}
        </div>
      </details>
    </Panel>
  );
}
