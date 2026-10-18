import { changePlay } from "../../app/play";
import { character, content, sheet } from "../../app/store";
import { pactLeft, setPactUsed, setSlotsUsed, slotsLeft, toggleCondition } from "../../engine/play";
import { ui } from "../../i18n/ui";
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

/** The spells the character can cast, grouped by level, each with its details one tap away. */
export function PlaySpells() {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s) return null;
  const rows = collectSpellRows(c, s);
  if (rows.length === 0) return null;
  const levels = [...new Set(rows.map((r) => r.level))];

  return (
    <Panel title={ui("play.spells")}>
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
                </li>
              ))}
          </ul>
        </div>
      ))}
    </Panel>
  );
}

/** The conditions of the rules, each a button that applies or removes it. */
export function Conditions() {
  const c = content.value;
  const play = character.value.play;
  if (!c) return null;
  const conditions = [...c.index.values()]
    .filter((e) => e.kind === "condition")
    .sort((a, b) => c.name(a.id).localeCompare(c.name(b.id)));
  const active = conditions.filter((e) => play.conditions.includes(e.id));

  return (
    <Panel title={ui("play.conditions")}>
      <p class="muted">{ui("play.conditionsHint")}</p>
      <div class="chips">
        {conditions.map((e) => {
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
        })}
      </div>
      {active.map((e) => (
        <RulesText key={e.id} name={c.name(e.id)} text={c.text(e.id, "desc")} />
      ))}
    </Panel>
  );
}
