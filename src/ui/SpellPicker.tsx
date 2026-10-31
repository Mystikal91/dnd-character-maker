import { useState } from "preact/hooks";
import { customSpellFor } from "../app/customSpell";
import { character, content, sheet, updateCharacter } from "../app/store";
import type { Content } from "../content/browser";
import type { ClassSpells } from "../engine/character";
import type { SpellcastingResult } from "../engine/derive";
import type { SpellPick } from "../engine/spells";
import { ui } from "../i18n/ui";
import { SpellInfoButton } from "./spells/SpellInfo";

type ListName = keyof ClassSpells;

interface ListProps {
  classId: string;
  list: ListName;
  title: string;
  pick: SpellPick;
  filter: string;
  c: Content;
}

const levelOf = (c: Content, id: string) => (c.index.get(id)?.data.level as number) ?? 0;

function SpellList({ classId, list, title, pick, filter, c }: ListProps) {
  const query = filter.trim().toLowerCase();
  const matches = pick.pool.filter((id) => !query || c.name(id).toLowerCase().includes(query));
  const levels = [...new Set(matches.map((id) => levelOf(c, id)))];
  const full = pick.chosen.length >= pick.allowed;
  // Limited to some schools: only a few picks may come from the others.
  const limit = pick.restriction;
  const schoolOf = (id: string) => String(c.index.get(id)?.data.school ?? "");
  const outsideLeft = limit
    ? limit.free - pick.chosen.filter((id) => !limit.schools.includes(schoolOf(id))).length
    : 0;
  const barred = (id: string) =>
    Boolean(limit && outsideLeft <= 0 && !limit.schools.includes(schoolOf(id)));

  const toggle = (spell: string, on: boolean) => {
    updateCharacter((d) => {
      const entry = d.spells[classId] ?? { cantrips: [], known: [], prepared: [] };
      d.spells[classId] = entry;
      entry[list] = on ? [...entry[list], spell] : entry[list].filter((s) => s !== spell);
      // Dropping a spell from the spellbook also un-prepares it.
      if (list === "known" && !on) entry.prepared = entry.prepared.filter((s) => s !== spell);
    });
  };

  return (
    <fieldset class="spell-list">
      <legend>{title}</legend>
      <p class={pick.chosen.length < pick.allowed ? "note" : "muted"}>
        {ui("spells.count", { n: pick.chosen.length, allowed: pick.allowed })}
      </p>
      {limit && (
        <p class="muted">
          {ui("spells.schoolLimit", {
            schools: limit.schools
              .map((s) => c.name(`${character.value.ruleset}:school/${s}`))
              .join(", "),
            free: Math.max(0, outsideLeft),
          })}
        </p>
      )}
      {matches.length === 0 && <p class="muted">{ui("spells.noMatches")}</p>}
      {levels.map((level) => (
        <details key={level} open={Boolean(query) || level <= 1}>
          <summary>{level === 0 ? ui("spells.cantrip") : ui("spells.level", { level })}</summary>
          <ul class="options">
            {matches
              .filter((id) => levelOf(c, id) === level)
              .map((id) => {
                const checked = pick.chosen.includes(id);
                const blocked = !checked && (full || barred(id));
                return (
                  <li key={id}>
                    <label class={blocked ? "disabled" : ""}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={blocked}
                        onChange={(e) => toggle(id, e.currentTarget.checked)}
                      />
                      {c.name(id)}
                    </label>
                    <SpellInfoButton id={id} />
                  </li>
                );
              })}
          </ul>
        </details>
      ))}
    </fieldset>
  );
}

/** The lists of one spellcasting class: cantrips, known or prepared spells, always prepared ones. */
function CasterSpells({
  caster,
  filter,
  c,
  heading,
}: {
  caster: SpellcastingResult;
  filter: string;
  c: Content;
  heading?: string;
}) {
  const { classId, lists } = caster;
  return (
    <div class="spell-class">
      {heading && <h4>{heading}</h4>}
      {lists.cantrips && (
        <SpellList
          classId={classId}
          list="cantrips"
          title={ui("spells.cantrips")}
          pick={lists.cantrips}
          filter={filter}
          c={c}
        />
      )}
      {lists.known && (
        <SpellList
          classId={classId}
          list="known"
          title={ui(lists.preparation === "spellbook" ? "spells.spellbook" : "spells.known")}
          pick={lists.known}
          filter={filter}
          c={c}
        />
      )}
      {lists.prepared && (
        <SpellList
          classId={classId}
          list="prepared"
          title={ui("spells.prepared")}
          pick={lists.prepared}
          filter={filter}
          c={c}
        />
      )}
      <button
        type="button"
        class="secondary"
        onClick={() => {
          customSpellFor.value = `${classId}|${lists.preparation === "prepared" ? "prepared" : "known"}`;
        }}
      >
        {ui("spells.create")}
      </button>
      {lists.alwaysPrepared.length > 0 && (
        <p class="muted">
          {ui("spells.alwaysPrepared")}: {lists.alwaysPrepared.map((id) => c.name(id)).join(", ")}
        </p>
      )}
    </div>
  );
}

/** Spell picks for every spellcasting class, one block each. */
export function SpellPicker() {
  const [filter, setFilter] = useState("");
  const c = content.value;
  const casters = sheet.value?.spellcasters ?? [];
  if (!c || casters.length === 0) return null;

  return (
    <fieldset class="spell-picker">
      <legend>{ui("spells.title")}</legend>
      <label class="field">
        <span>{ui("spells.filter")}</span>
        <input type="search" value={filter} onInput={(e) => setFilter(e.currentTarget.value)} />
      </label>
      {casters.map((caster) => (
        <CasterSpells
          key={caster.classId}
          caster={caster}
          filter={filter}
          c={c}
          heading={casters.length > 1 ? c.name(caster.classId) : undefined}
        />
      ))}
    </fieldset>
  );
}
