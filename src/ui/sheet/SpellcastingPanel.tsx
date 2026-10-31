import { character, content, isForced, shownSheet } from "../../app/store";
import { OVERRIDE } from "../../engine/overrides";
import { signed, ui } from "../../i18n/ui";
import { Stat } from "./CoreStats";
import { Panel, Pips } from "./parts";

/** Spell attack, save DC, how many spells are known, and the slots to tick off. */
export function SpellcastingPanel() {
  const c = content.value;
  const s = shownSheet.value;
  const ch = character.value;
  const casters = s?.spellcasters ?? [];
  if (!c || !s || casters.length === 0) return null;
  const slots = s.spellSlots.map((n, i) => ({ level: i + 1, n })).filter((x) => x.n > 0);

  return (
    <Panel title={ui("sheet.spellcasting")}>
      {casters.map((caster) => (
        <div key={caster.classId}>
          {casters.length > 1 && <h4>{c.name(caster.classId)}</h4>}
          <div class="stat-row stat-row-4">
            <Stat label={ui("sheet.spellAttack")} forced={isForced(OVERRIDE.spellAttack)}>
              {signed(caster.attackBonus)}
            </Stat>
            <Stat label={ui("sheet.spellSaveDc")} forced={isForced(OVERRIDE.spellSaveDc)}>
              {caster.saveDc}
            </Stat>
            <div class="stat">
              <div class="stat-value">{caster.cantripsKnown ?? "—"}</div>
              <div class="stat-label">{ui("sheet.cantrips")}</div>
            </div>
            <div class="stat">
              <div class="stat-value">{caster.spellsKnown ?? "—"}</div>
              <div class="stat-label">{ui("sheet.spellsKnown")}</div>
            </div>
          </div>
          <p class="muted">
            {ui("sheet.spellAbility")}: {c.name(`${ch.ruleset}:ability/${caster.ability}`)}
          </p>
        </div>
      ))}
      <h4>{ui("sheet.spellSlots")}</h4>
      <ul class="slot-list">
        {slots.map((x) => (
          <li key={x.level}>
            <span class="slot-level">{ui("sheet.slotLevel", { level: x.level })}</span>
            <Pips count={x.n} />
          </li>
        ))}
      </ul>
      {s.pactSlots && (
        <p class="muted">
          {ui("sheet.pact", { count: s.pactSlots.count, level: s.pactSlots.level })}
        </p>
      )}
    </Panel>
  );
}
