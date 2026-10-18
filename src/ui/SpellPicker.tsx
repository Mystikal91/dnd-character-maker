import { useState } from "preact/hooks";
import { content, sheet, updateCharacter } from "../app/store";
import type { Content } from "../content/browser";
import type { ClassSpells } from "../engine/character";
import type { SpellPick } from "../engine/spells";
import { ui } from "../i18n/ui";

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
      {matches.length === 0 && <p class="muted">{ui("spells.noMatches")}</p>}
      {levels.map((level) => (
        <details key={level} open={Boolean(query) || level <= 1}>
          <summary>{level === 0 ? ui("spells.cantrip") : ui("spells.level", { level })}</summary>
          <ul class="options">
            {matches
              .filter((id) => levelOf(c, id) === level)
              .map((id) => {
                const checked = pick.chosen.includes(id);
                return (
                  <li key={id}>
                    <label class={!checked && full ? "disabled" : ""}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && full}
                        onChange={(e) => toggle(id, e.currentTarget.checked)}
                      />
                      {c.name(id)}
                    </label>
                  </li>
                );
              })}
          </ul>
        </details>
      ))}
    </fieldset>
  );
}

export function SpellPicker() {
  const [filter, setFilter] = useState("");
  const c = content.value;
  const caster = sheet.value?.spellcasting;
  if (!c || !caster) return null;
  const { classId, lists } = caster;

  return (
    <fieldset class="spell-picker">
      <legend>{ui("spells.title")}</legend>
      <label class="field">
        <span>{ui("spells.filter")}</span>
        <input type="search" value={filter} onInput={(e) => setFilter(e.currentTarget.value)} />
      </label>
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
      {lists.alwaysPrepared.length > 0 && (
        <p class="muted">
          {ui("spells.alwaysPrepared")}: {lists.alwaysPrepared.map((id) => c.name(id)).join(", ")}
        </p>
      )}
    </fieldset>
  );
}
