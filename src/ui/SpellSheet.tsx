import { character, content, sheet } from "../app/store";
import type { Content } from "../content/browser";
import { ui } from "../i18n/ui";

interface SpellRow {
  id: string;
  level: number;
  /** Where the spell comes from, shown next to its name. */
  alwaysPrepared: boolean;
}

function SpellDetails({ c, ruleset, row }: { c: Content; ruleset: string; row: SpellRow }) {
  const data = c.index.get(row.id)?.data ?? {};
  const school = c.name(`${ruleset}:school/${data.school}`);
  const components = (data.components as string[] | undefined)?.join(", ");
  const material = c.text(row.id, "material");
  const meta: [string, string | undefined][] = [
    [ui("spells.castingTime"), c.text(row.id, "castingTime")],
    [ui("spells.range"), c.text(row.id, "range")],
    [ui("spells.components"), components && material ? `${components} (${material})` : components],
    [ui("spells.duration"), c.text(row.id, "duration")],
  ];
  const tags = [
    data.concentration ? ui("spells.concentration") : undefined,
    data.ritual ? ui("spells.ritual") : undefined,
    row.alwaysPrepared ? ui("spells.alwaysPrepared") : undefined,
  ].filter(Boolean);

  return (
    <details>
      <summary>
        {c.name(row.id)}
        <span class="muted">
          {" "}
          {row.level === 0
            ? ui("spells.cantripSchool", { school })
            : ui("spells.levelSchool", { level: row.level, school })}
          {tags.length > 0 && ` · ${tags.join(" · ")}`}
        </span>
      </summary>
      <dl class="pairs spell-meta">
        {meta.map(([label, value]) =>
          value ? (
            <div class="pair" key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ) : null,
        )}
      </dl>
      {c
        .text(row.id, "desc")
        ?.split("\n\n")
        .map((p) => (
          <p key={p}>{p}</p>
        ))}
      {c.text(row.id, "higherLevel") && (
        <p>
          <strong>{ui("spells.higherLevel")}.</strong> {c.text(row.id, "higherLevel")}
        </p>
      )}
    </details>
  );
}

/** Every spell the character has: picked cantrips, known or prepared spells, and granted ones. */
export function SpellSheet() {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s) return null;
  const ruleset = character.value.ruleset;
  const lists = s.spellcasting?.lists;

  const rows = new Map<string, SpellRow>();
  const add = (id: string, alwaysPrepared = false) => {
    const level = (c.index.get(id)?.data.level as number | undefined) ?? 0;
    const existing = rows.get(id);
    rows.set(id, {
      id,
      level,
      alwaysPrepared: alwaysPrepared || (existing?.alwaysPrepared ?? false),
    });
  };
  for (const id of lists?.cantrips?.chosen ?? []) add(id);
  // Known casters use their known list; prepared casters and wizards use what they prepared.
  for (const id of lists?.preparation === "known"
    ? (lists.known?.chosen ?? [])
    : (lists?.prepared?.chosen ?? []))
    add(id);
  for (const id of lists?.alwaysPrepared ?? []) add(id, true);
  for (const id of s.grantedSpells) add(id);

  if (rows.size === 0) return null;
  const levels = [...new Set([...rows.values()].map((r) => r.level))].sort((a, b) => a - b);

  return (
    <section class="card">
      <h3>{ui("sheet.spellList")}</h3>
      {levels.map((level) => (
        <div key={level}>
          <h4>{level === 0 ? ui("spells.cantrips") : ui("spells.level", { level })}</h4>
          {[...rows.values()]
            .filter((r) => r.level === level)
            .sort((a, b) => c.name(a.id).localeCompare(c.name(b.id)))
            .map((row) => (
              <SpellDetails key={row.id} c={c} ruleset={ruleset} row={row} />
            ))}
        </div>
      ))}
    </section>
  );
}
