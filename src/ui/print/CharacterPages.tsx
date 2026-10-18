import type { ComponentChildren } from "preact";
import { character, content, sheet } from "../../app/store";
import { ABILITIES } from "../../data/schema";
import type { DamageResult } from "../../engine/equipment";
import { signed, ui } from "../../i18n/ui";

const PROFICIENCY_LABELS = {
  armor: "sheet.armor",
  weapon: "sheet.weapons",
  tool: "sheet.tools",
  language: "sheet.languages",
} as const;
const BLANK_ATTACK_ROWS = 5;
const COINS = ["CP", "SP", "EP", "GP", "PP"];

const formatDamage = (d: DamageResult) =>
  `${d.dice}${d.bonus === 0 ? "" : signed(d.bonus)} ${d.type}`;

function Box({ label, children }: { label: string; children?: ComponentChildren }) {
  return (
    <div class="p-box">
      <div class="p-box-value">{children}</div>
      <div class="p-box-label">{label}</div>
    </div>
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

/** Page 1: the numbers a player needs at the table. */
function FrontPage() {
  const c = content.value;
  const s = sheet.value;
  const ch = character.value;
  if (!c || !s) return null;
  const ruleset = ch.ruleset;
  const name = c.name;

  const classes = ch.classes.map((cl) => `${name(cl.classId)} ${cl.level}`).join(" / ");
  const species = [ch.choices.species, ch.choices.subspecies]
    .filter((id): id is string => Boolean(id))
    .map(name)
    .join(", ");
  const list = (category: "armor" | "weapon" | "tool" | "language") =>
    s.proficiencies[category]
      .map((t) =>
        category === "language"
          ? name(`${ruleset}:language/${t}`)
          : name(`${ruleset}:proficiency/${t}`),
      )
      .join(", ");
  const skills = [...s.skills].sort((a, b) => name(a.id).localeCompare(name(b.id)));
  const attackRows = Math.max(BLANK_ATTACK_ROWS, s.attacks.length);

  return (
    <section class="p-page p-front">
      <header class="p-header">
        <h1>{ch.name || ui("sheet.unnamed")}</h1>
        <dl class="p-fields">
          <div>
            <dd>{classes || " "}</dd>
            <dt>{ui("print.class")}</dt>
          </div>
          <div>
            <dd>{ch.choices.background ? name(ch.choices.background) : " "}</dd>
            <dt>{ui("print.background")}</dt>
          </div>
          <div>
            <dd>{species || " "}</dd>
            <dt>{ui("print.species")}</dt>
          </div>
          <div>
            <dd>{" "}</dd>
            <dt>{ui("print.player")}</dt>
          </div>
          <div>
            <dd>{" "}</dd>
            <dt>{ui("print.xp")}</dt>
          </div>
        </dl>
      </header>

      <div class="p-columns">
        <div class="p-col">
          <div class="p-abilities">
            {ABILITIES.map((a) => (
              <div class="p-ability" key={a}>
                <div class="p-ability-name">{c.text(`${ruleset}:ability/${a}`, "name")}</div>
                <div class="p-ability-mod">{signed(s.abilities[a].modifier)}</div>
                <div class="p-ability-score">{s.abilities[a].score}</div>
              </div>
            ))}
          </div>
          <div class="p-row2">
            <Box label={ui("print.inspiration")} />
            <Box label={ui("sheet.proficiencyBonus")}>{signed(s.proficiencyBonus)}</Box>
          </div>
          <h2>{ui("sheet.saves")}</h2>
          <ul class="p-checks">
            {ABILITIES.map((a) => (
              <li key={a}>
                <span class="p-dot">{s.saves[a].proficient ? "●" : "○"}</span>
                <span class="p-num">{signed(s.saves[a].bonus)}</span>
                {c.text(`${ruleset}:ability/${a}`, "name")}
              </li>
            ))}
          </ul>
          <h2>{ui("sheet.skills")}</h2>
          <ul class="p-checks p-skills">
            {skills.map((sk) => (
              <li key={sk.id}>
                <span class="p-dot">{sk.proficient ? "●" : "○"}</span>
                <span class="p-num">{signed(sk.bonus)}</span>
                {name(sk.id)}
                <span class="p-muted">
                  {" "}
                  ({c.text(`${ruleset}:ability/${sk.ability}`, "abbreviation")})
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div class="p-col">
          <div class="p-row3">
            <Box label={ui("sheet.armorClass")}>{s.armorClass.value}</Box>
            <Box label={ui("sheet.initiative")}>{signed(s.initiative)}</Box>
            <Box label={ui("sheet.speed")}>{s.speed === undefined ? "" : s.speed}</Box>
          </div>
          <div class="p-hp">
            <div class="p-hp-max">
              {ui("print.maxHp")}: <strong>{s.hitPoints.max}</strong>
            </div>
            <div class="p-hp-current" />
            <div class="p-box-label">{ui("print.currentHp")}</div>
          </div>
          <div class="p-row2">
            <div class="p-hp-temp">
              <div class="p-hp-current small" />
              <div class="p-box-label">{ui("print.tempHp")}</div>
            </div>
            <div class="p-hitdice">
              <div class="p-box-value">
                {Object.entries(s.hitPoints.hitDice)
                  .map(([die, n]) => `${n}${die}`)
                  .join(" + ") || " "}
              </div>
              <div class="p-box-label">{ui("print.hitDiceTotal")}</div>
            </div>
          </div>
          <div class="p-death">
            <div>
              {ui("print.successes")} <span class="p-circles">○ ○ ○</span>
            </div>
            <div>
              {ui("print.failures")} <span class="p-circles">○ ○ ○</span>
            </div>
            <div class="p-box-label">{ui("print.deathSaves")}</div>
          </div>

          <h2>{ui("sheet.attacks")}</h2>
          <table class="p-attacks">
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

          <h2>{ui("print.equipment")}</h2>
          <div class="p-coins">
            {COINS.map((coin) => (
              <div class="p-coin" key={coin}>
                <div class="p-coin-box" />
                {coin}
              </div>
            ))}
          </div>
          <ul class="p-lines">
            {ch.inventory.map((i) => (
              <li key={i.itemId}>
                {name(i.itemId)}
                {i.quantity > 1 && ` ×${i.quantity}`}
                {i.equipped && " ✓"}
              </li>
            ))}
            {Array.from({ length: Math.max(0, 8 - ch.inventory.length) }, (_, i) => (
              <li class="p-blank" key={`line-${i + 1}`}>
                {" "}
              </li>
            ))}
          </ul>
          <p class="p-muted">
            {ui("sheet.load", { carried: s.load.carried, capacity: s.load.capacity })}
          </p>
        </div>

        <div class="p-col">
          <Box label={ui("sheet.passivePerception")}>{s.passivePerception}</Box>
          <h2>{ui("sheet.proficiencies")}</h2>
          <dl class="p-prof">
            {(["armor", "weapon", "tool", "language"] as const).map((cat) => (
              <div key={cat}>
                <dt>{ui(PROFICIENCY_LABELS[cat])}</dt>
                <dd>{list(cat) || "—"}</dd>
              </div>
            ))}
          </dl>
          <h2>{ui("sheet.traits")}</h2>
          <ul class="p-names">
            {s.traits.map((id) => (
              <li key={id}>{name(id)}</li>
            ))}
          </ul>
          <h2>{ui("sheet.features")}</h2>
          <ul class="p-names">
            {s.features.map((id) => (
              <li key={id}>{name(id)}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Page 2 onwards: the full text of traits and features, flowing across pages as needed. */
function FeaturePages() {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s || s.traits.length + s.features.length === 0) return null;
  const entries = [...s.traits, ...s.features];
  return (
    <section class="p-page p-features">
      <h2 class="p-title">{ui("print.page.features")}</h2>
      <div class="p-flow">
        {entries.map((id) => (
          <article key={id}>
            <h3>{c.name(id)}</h3>
            <Paragraphs text={c.text(id, "desc")} />
          </article>
        ))}
      </div>
    </section>
  );
}

export function CharacterPages() {
  return (
    <>
      <FrontPage />
      <FeaturePages />
    </>
  );
}
