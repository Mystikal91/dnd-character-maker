import { type ComponentChildren, Fragment } from "preact";
import { character, content, sheet } from "../app/store";
import { ABILITIES } from "../data/schema";
import type { DamageResult } from "../engine/equipment";
import type { Warning } from "../engine/warnings";
import { type UiKey, signed, ui } from "../i18n/ui";

const PROFICIENCY_CATEGORIES = ["armor", "weapon", "tool", "language"] as const;
const PROFICIENCY_LABELS = {
  armor: "sheet.armor",
  weapon: "sheet.weapons",
  tool: "sheet.tools",
  language: "sheet.languages",
} as const;

const formatDamage = (d: DamageResult) =>
  `${d.dice}${d.bonus === 0 ? "" : signed(d.bonus)} ${d.type}`;

function Stat({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="stat">
      <div class="stat-value">{children}</div>
      <div class="stat-label">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <section class="card">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Paragraphs({ text }: { text: string | undefined }) {
  return (
    <>
      {text?.split("\n\n").map((p) => (
        <p key={p}>{p}</p>
      ))}
    </>
  );
}

export function Sheet() {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s) return null;
  const ch = character.value;
  const name = c.name;

  const origin = [
    ch.choices.species && name(ch.choices.species),
    ch.choices.subspecies && `(${name(ch.choices.subspecies)})`,
  ]
    .filter(Boolean)
    .join(" ");
  const classes =
    ch.classes.map((cl) => `${name(cl.classId)} ${cl.level}`).join(" / ") || ui("sheet.noClass");

  const proficiencyList = (category: "armor" | "weapon" | "tool" | "language") =>
    s.proficiencies[category]
      .map((target) =>
        category === "language"
          ? name(`${ch.ruleset}:language/${target}`)
          : name(`${ch.ruleset}:proficiency/${target}`),
      )
      .join(", ");

  /** Warning params are ids, ability ids or numbers; ids become names, abilities become abbreviations. */
  const formatWarning = (w: Warning) => {
    const params = Object.fromEntries(
      Object.entries(w.params).map(([key, value]) => {
        if (key === "ability")
          return [key, c.text(`${ch.ruleset}:ability/${value}`, "abbreviation") ?? value];
        const isId = typeof value === "string" && /^[a-z0-9]+:[a-z]+\//.test(value);
        return [key, isId ? name(value) : value];
      }),
    );
    return ui(`warning.${w.code}` as UiKey, params);
  };

  const slots = s.spellcasting?.spellSlots.map((n, i) => ({ level: i + 1, n })).filter((x) => x.n);

  return (
    <div class="sheet">
      <header class="card sheet-header">
        <h2>{ch.name || ui("sheet.unnamed")}</h2>
        <p>{ui("sheet.summary", { origin: origin || "—", classes })}</p>
      </header>

      <div class="stats">
        <Stat label={ui("sheet.armorClass")}>{s.armorClass.value}</Stat>
        <Stat label={ui("sheet.initiative")}>{signed(s.initiative)}</Stat>
        <Stat label={ui("sheet.speed")}>
          {s.speed === undefined ? "—" : ui("sheet.speedValue", { feet: s.speed })}
        </Stat>
        <Stat label={ui("sheet.hitPoints")}>{s.hitPoints.max}</Stat>
        <Stat label={ui("sheet.proficiencyBonus")}>{signed(s.proficiencyBonus)}</Stat>
        <Stat label={ui("sheet.passivePerception")}>{s.passivePerception}</Stat>
      </div>
      {s.armorClass.stealthDisadvantage && <p class="note">{ui("sheet.stealthDisadvantage")}</p>}

      <Section title={ui("sheet.abilities")}>
        <div class="abilities">
          {ABILITIES.map((a) => (
            <div class="ability" key={a}>
              <div class="ability-name">{c.text(`${ch.ruleset}:ability/${a}`, "abbreviation")}</div>
              <div class="ability-score">{s.abilities[a].score}</div>
              <div class="ability-mod">{signed(s.abilities[a].modifier)}</div>
              <div class={`ability-save${s.saves[a].proficient ? " proficient" : ""}`}>
                {ui("sheet.saves")} {signed(s.saves[a].bonus)}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={ui("sheet.skills")}>
        <ul class="skills">
          {s.skills.map((skill) => (
            <li key={skill.id} class={skill.proficient ? "proficient" : ""}>
              <span class="bonus">{signed(skill.bonus)}</span>
              <span>{name(skill.id)}</span>
              <span class="muted">
                {c.text(`${ch.ruleset}:ability/${skill.ability}`, "abbreviation")}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={ui("sheet.attacks")}>
        {s.attacks.length === 0 ? (
          <p class="muted">{ui("sheet.noAttacks")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th />
                <th>{ui("sheet.attackBonus")}</th>
                <th>{ui("sheet.damage")}</th>
              </tr>
            </thead>
            <tbody>
              {s.attacks.map((a) => (
                <tr key={a.itemId}>
                  <td>{name(a.itemId)}</td>
                  <td>{signed(a.attackBonus)}</td>
                  <td>
                    {a.damage && formatDamage(a.damage)}
                    {a.twoHandedDamage && (
                      <div class="muted">
                        {formatDamage(a.twoHandedDamage)} ({ui("sheet.twoHanded")})
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {s.spellcasting && (
        <Section title={ui("sheet.spellcasting")}>
          <dl class="pairs">
            <dt>{ui("sheet.spellAbility")}</dt>
            <dd>{c.text(`${ch.ruleset}:ability/${s.spellcasting.ability}`, "name")}</dd>
            <dt>{ui("sheet.spellSaveDc")}</dt>
            <dd>{s.spellcasting.saveDc}</dd>
            <dt>{ui("sheet.spellAttack")}</dt>
            <dd>{signed(s.spellcasting.attackBonus)}</dd>
            {s.spellcasting.cantripsKnown !== undefined && (
              <>
                <dt>{ui("sheet.cantrips")}</dt>
                <dd>{s.spellcasting.cantripsKnown}</dd>
              </>
            )}
            {s.spellcasting.spellsKnown !== undefined && (
              <>
                <dt>{ui("sheet.spellsKnown")}</dt>
                <dd>{s.spellcasting.spellsKnown}</dd>
              </>
            )}
          </dl>
          <h4>{ui("sheet.spellSlots")}</h4>
          <ul class="slots">
            {slots?.map((x) => (
              <li key={x.level}>
                {ui("sheet.slotLevel", { level: x.level })}: <strong>{x.n}</strong>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={ui("sheet.proficiencies")}>
        <dl class="pairs">
          {PROFICIENCY_CATEGORIES.map((cat) => (
            <Fragment key={cat}>
              <dt>{ui(PROFICIENCY_LABELS[cat])}</dt>
              <dd>{proficiencyList(cat) || "—"}</dd>
            </Fragment>
          ))}
          <dt>{ui("sheet.hitDice")}</dt>
          <dd>
            {Object.entries(s.hitPoints.hitDice)
              .map(([die, n]) => `${n}${die}`)
              .join(" + ") || "—"}
          </dd>
        </dl>
      </Section>

      {s.traits.length > 0 && (
        <Section title={ui("sheet.traits")}>
          {s.traits.map((id) => (
            <details key={id}>
              <summary>{name(id)}</summary>
              <Paragraphs text={c.text(id, "desc")} />
            </details>
          ))}
        </Section>
      )}

      {s.features.length > 0 && (
        <Section title={ui("sheet.features")}>
          {s.features.map((id) => (
            <details key={id}>
              <summary>{name(id)}</summary>
              <Paragraphs text={c.text(id, "desc")} />
            </details>
          ))}
        </Section>
      )}

      {ch.inventory.length > 0 && (
        <Section title={ui("sheet.inventory")}>
          <ul>
            {ch.inventory.map((i) => (
              <li key={i.itemId}>
                {name(i.itemId)}
                {i.quantity > 1 && ` ×${i.quantity}`}
              </li>
            ))}
          </ul>
          <p class="muted">
            {ui("sheet.load", { carried: s.load.carried, capacity: s.load.capacity })}
          </p>
        </Section>
      )}

      {s.warnings.length > 0 && (
        <Section title={ui("sheet.warnings")}>
          <ul class="warnings">
            {s.warnings.map((w) => {
              const text = formatWarning(w);
              return <li key={text}>{text}</li>;
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}
