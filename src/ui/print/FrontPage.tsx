import { character, content, sheet } from "../../app/store";
import type { Content } from "../../content/browser";
import { classData, subclassData } from "../../data/progression";
import { ABILITIES } from "../../data/schema";
import type { ClassLevel } from "../../engine/character";
import type { DamageResult } from "../../engine/equipment";
import { signed, ui } from "../../i18n/ui";
import { distance } from "../../i18n/units";
import { extraAmount, extraName } from "../sheet/ExtraDamage";
import { collectSpellRows } from "../spellRows";

const BLANK_ATTACK_ROWS = 4;
const PROFICIENCY_CATEGORIES = ["armor", "weapon", "tool", "language"] as const;
const PROFICIENCY_LABELS = {
  armor: "sheet.armor",
  weapon: "sheet.weapons",
  tool: "sheet.tools",
  language: "sheet.languages",
} as const;

const formatDamage = (d: DamageResult) =>
  `${d.dice}${d.bonus === 0 ? "" : signed(d.bonus)} ${d.type}`;

/** Names of the features gained at each level reached, from the class and its subclass. */
function featureRows(c: Content, cl: ClassLevel): [number, string[]][] {
  const byLevel = new Map<number, string[]>();
  const add = (level: number, ids: string[]) => {
    if (level <= cl.level && ids.length > 0)
      byLevel.set(level, [...(byLevel.get(level) ?? []), ...ids]);
  };
  const entry = c.index.get(cl.classId);
  if (entry) for (const row of classData(entry).levels) add(row.level, row.features);
  const sub = cl.subclassId ? c.index.get(cl.subclassId) : undefined;
  if (sub) for (const row of subclassData(sub).levels) add(row.level, row.features);
  return [...byLevel.entries()].sort(([a], [b]) => a - b);
}

/** The main sheet: everything needed at the table, laid out like the on-screen sheet. */
export function FrontPage() {
  const c = content.value;
  const s = sheet.value;
  const ch = character.value;
  if (!c || !s) return null;
  const ruleset = ch.ruleset;
  const name = c.name;

  const totalLevel = ch.classes.reduce((sum, cl) => sum + cl.level, 0);
  const first = ch.classes[0];
  const classTitle = ch.classes.map((cl) => name(cl.classId)).join(" / ") || ui("sheet.noClass");
  const species = [ch.choices.species, ch.choices.subspecies]
    .filter((id): id is string => Boolean(id))
    .map(name)
    .join(", ");
  const spellRows = collectSpellRows(c, s);
  const spellLevels = [...new Set(spellRows.map((r) => r.level))];
  const insight = s.skills.find((sk) => sk.id === `${ruleset}:skill/insight`);
  const attackRows = Math.max(BLANK_ATTACK_ROWS, s.attacks.length);
  const caster = s.spellcasting;
  const slots = caster?.spellSlots.map((n, i) => ({ level: i + 1, n })).filter((x) => x.n > 0);
  const hitDice = Object.entries(s.hitPoints.hitDice)
    .map(([die, n]) => `${n}${die}`)
    .join(" + ");
  const list = (category: (typeof PROFICIENCY_CATEGORIES)[number]) =>
    s.proficiencies[category]
      .map((t) =>
        category === "language"
          ? name(`${ruleset}:language/${t}`)
          : name(`${ruleset}:proficiency/${t}`),
      )
      .join(", ");

  return (
    <section class="p-page p-front">
      <header class="p-head">
        <div class="p-banner">
          <h1>{ch.name || ui("sheet.unnamed")}</h1>
          <small>{ui("sheet.name")}</small>
        </div>
        <div class="p-frame p-info">
          <dl class="p-fields">
            <div>
              <dd>{species || " "}</dd>
              <dt>{ui("print.species")}</dt>
            </div>
            <div>
              <dd>{ch.choices.background ? name(ch.choices.background) : " "}</dd>
              <dt>{ui("print.background")}</dt>
            </div>
            <div>
              <dd>{ui("sheet.levelLabel", { level: totalLevel })}</dd>
              <dt>{ui("form.level")}</dt>
            </div>
            <div>
              <dd>{ch.story.alignment ? name(ch.story.alignment) : " "}</dd>
              <dt>{ui("story.alignment")}</dt>
            </div>
          </dl>
        </div>
        <div class="p-banner">
          <h2>{classTitle}</h2>
          <small>
            {first?.subclassId
              ? name(first.subclassId)
              : ui("sheet.levelLabel", { level: totalLevel })}
          </small>
        </div>
      </header>

      <div class="p-cols">
        <div class="p-col">
          <div class="p-badges">
            <div class="p-badge">
              <b>{signed(s.proficiencyBonus)}</b>
              <span>{ui("sheet.proficiencyBonus")}</span>
            </div>
            <div class="p-badge">
              <b>{s.passivePerception}</b>
              <span>{ui("sheet.passivePerception")}</span>
            </div>
            <div class="p-badge">
              <b>{10 + (insight?.bonus ?? s.abilities.wis.modifier)}</b>
              <span>{ui("sheet.passiveInsight")}</span>
            </div>
          </div>

          {ABILITIES.map((a) => (
            <section class="p-frame p-ability" key={a}>
              <div class="p-ability-core">
                <div class="p-ability-name">{name(`${ruleset}:ability/${a}`)}</div>
                <div class="p-oval">{s.abilities[a].score}</div>
                <div class="p-ability-mod">{signed(s.abilities[a].modifier)}</div>
              </div>
              <ul class="p-checks">
                <li class={s.saves[a].proficient ? "on" : ""}>
                  <span class={`p-pip${s.saves[a].proficient ? " on" : ""}`} />
                  <b>{signed(s.saves[a].bonus)}</b>
                  {ui("sheet.savingThrow")}
                </li>
                {s.skills
                  .filter((sk) => sk.ability === a)
                  .sort((x, y) => name(x.id).localeCompare(name(y.id)))
                  .map((sk) => (
                    <li key={sk.id} class={sk.proficient ? "on" : ""}>
                      <span class={`p-pip${sk.proficient ? " on" : ""}`} />
                      <b>{signed(sk.bonus)}</b>
                      {name(sk.id)}
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>

        <div class="p-col">
          <div class="p-stat-row">
            <div class="p-frame p-box">
              <b>{s.armorClass.value}</b>
              <span>{ui("sheet.armorClass")}</span>
            </div>
            <div class="p-frame p-box">
              <b>{signed(s.initiative)}</b>
              <span>{ui("sheet.initiative")}</span>
            </div>
            <div class="p-frame p-box">
              <b>{s.speed === undefined ? "" : distance(s.speed)}</b>
              <span>{ui("sheet.speed")}</span>
            </div>
          </div>

          <div class="p-frame p-hp">
            <div class="p-hp-max">
              <span class="p-caption">{ui("print.maxHp")}</span>
              <b>{s.hitPoints.max}</b>
            </div>
            <div class="p-write" />
            <div class="p-caption">{ui("print.currentHp")}</div>
          </div>
          <div class="p-two">
            <div class="p-frame p-box">
              <div class="p-write small" />
              <span>{ui("print.tempHp")}</span>
            </div>
            <div class="p-frame p-box">
              <b>{hitDice || " "}</b>
              <span>{ui("print.hitDiceTotal")}</span>
            </div>
          </div>
          <div class="p-frame p-death">
            <div class="row">
              <span>{ui("print.successes")}</span>
              <span>
                <span class="p-pip" />
                <span class="p-pip" />
                <span class="p-pip" />
              </span>
            </div>
            <div class="row">
              <span>{ui("print.failures")}</span>
              <span>
                <span class="p-pip" />
                <span class="p-pip" />
                <span class="p-pip" />
              </span>
            </div>
            <div class="p-caption">{ui("print.deathSaves")}</div>
          </div>

          <section class="p-frame p-panel">
            <h3 class="p-h">{ui("sheet.attacks")}</h3>
            <table class="p-table">
              <thead>
                <tr>
                  <th>{ui("print.name")}</th>
                  <th>{ui("sheet.attackBonus")}</th>
                  <th>{ui("sheet.damage")}</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: attackRows }, (_, i) => {
                  const a = s.attacks[i];
                  return (
                    <tr key={a?.itemId ?? `blank-${i + 1}`}>
                      <td>{a ? name(a.itemId) : " "}</td>
                      <td>{a ? signed(a.attackBonus) : ""}</td>
                      <td>{a?.damage ? formatDamage(a.damage) : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {s.extraDamage.length > 0 && (
              <p class="p-extra">
                {s.extraDamage.map((x) => `${extraName(x)} ${extraAmount(x)}`).join(" · ")}
              </p>
            )}
          </section>

          {caster && (
            <section class="p-frame p-panel">
              <h3 class="p-h">{ui("sheet.spellcasting")}</h3>
              <div class="p-stat-row">
                <div class="p-box">
                  <b>{signed(caster.attackBonus)}</b>
                  <span>{ui("sheet.spellAttack")}</span>
                </div>
                <div class="p-box">
                  <b>{caster.saveDc}</b>
                  <span>{ui("sheet.spellSaveDc")}</span>
                </div>
                <div class="p-box">
                  <b>{name(`${ruleset}:ability/${caster.ability}`).slice(0, 3)}</b>
                  <span>{ui("sheet.spellAbility")}</span>
                </div>
              </div>
              {slots?.map((x) => (
                <div class="p-slotrow" key={x.level}>
                  <span class="lvl">{ui("sheet.slotLevel", { level: x.level })}</span>
                  <span>
                    {Array.from({ length: x.n }, (_, i) => (
                      <span class="p-pip" key={`slot-${x.level}-${i + 1}`} />
                    ))}
                  </span>
                </div>
              ))}
            </section>
          )}

          {spellRows.length > 0 && (
            <section class="p-frame p-panel">
              <h3 class="p-h">{ui("sheet.spellList")}</h3>
              {spellLevels.map((level) => (
                <div class="p-quick-row" key={level}>
                  <span class="lvl">
                    {level === 0 ? ui("spells.cantrips") : ui("spells.level", { level })}
                  </span>
                  <span class="items">
                    {spellRows
                      .filter((r) => r.level === level)
                      .map((r) => (
                        <span class="item" key={r.id}>
                          <span class={`p-pip${r.alwaysPrepared ? " on" : ""}`} />
                          {name(r.id)}
                        </span>
                      ))}
                  </span>
                </div>
              ))}
            </section>
          )}

          <section class="p-frame p-panel grow">
            <h3 class="p-h">{ui("print.notes")}</h3>
            <div class="p-ruled-area" />
          </section>
        </div>

        <div class="p-col">
          <section class="p-frame p-panel">
            <h3 class="p-h">{ui("sheet.proficiencies")}</h3>
            <dl class="p-prof">
              {PROFICIENCY_CATEGORIES.map((cat) => (
                <div key={cat}>
                  <dt>{ui(PROFICIENCY_LABELS[cat])}</dt>
                  <dd>{list(cat) || "—"}</dd>
                </div>
              ))}
            </dl>
          </section>

          {s.traits.length > 0 && (
            <section class="p-frame p-panel">
              <h3 class="p-h">{ui("sheet.speciesTraits")}</h3>
              <ul class="p-names">
                {s.traits.map((id) => (
                  <li key={id}>{name(id)}</li>
                ))}
              </ul>
            </section>
          )}

          {ch.classes.map((cl) => (
            <section class="p-frame p-panel" key={cl.classId}>
              <h3 class="p-h">{ui("sheet.classFeatures")}</h3>
              {featureRows(c, cl).map(([level, ids]) => (
                <div class="p-level-row" key={level}>
                  <span class="p-level">{level}</span>
                  <span class="names">{ids.map((id) => name(id)).join(", ")}</span>
                </div>
              ))}
            </section>
          ))}

          {(ch.custom ?? []).some((f) => f.name.trim() !== "") && (
            <section class="p-frame p-panel">
              <h3 class="p-h">{ui("sheet.customFeatures")}</h3>
              <ul class="p-names">
                {(ch.custom ?? [])
                  .filter((f) => f.name.trim() !== "")
                  .map((f) => (
                    <li key={f.id}>
                      {f.name}
                      {f.uses ? ` (${f.uses})` : ""}
                    </li>
                  ))}
              </ul>
            </section>
          )}

          <section class="p-frame p-panel grow">
            <h3 class="p-h">{ui("print.notes")}</h3>
            <div class="p-ruled-area" />
          </section>
        </div>
      </div>
    </section>
  );
}
