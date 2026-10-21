import { Fragment } from "preact";
import { character, content, sheet } from "../../app/store";
import type { Warning } from "../../engine/warnings";
import { type UiKey, ui } from "../../i18n/ui";
import { weight } from "../../i18n/units";
import { Panel, RulesText } from "./parts";

const PROFICIENCY_CATEGORIES = ["armor", "weapon", "tool", "language"] as const;
const PROFICIENCY_LABELS = {
  armor: "sheet.armor",
  weapon: "sheet.weapons",
  tool: "sheet.tools",
  language: "sheet.languages",
} as const;

/** Armor, weapon, tool and language proficiencies. */
export function Proficiencies() {
  const c = content.value;
  const s = sheet.value;
  const ch = character.value;
  if (!c || !s) return null;
  const list = (category: (typeof PROFICIENCY_CATEGORIES)[number]) =>
    s.proficiencies[category]
      .map((target) =>
        category === "language"
          ? c.name(`${ch.ruleset}:language/${target}`)
          : c.name(`${ch.ruleset}:proficiency/${target}`),
      )
      .join(", ");

  return (
    <Panel title={ui("sheet.proficiencies")}>
      <dl class="pairs">
        {PROFICIENCY_CATEGORIES.map((cat) => (
          <Fragment key={cat}>
            <dt>{ui(PROFICIENCY_LABELS[cat])}</dt>
            <dd>{list(cat) || "—"}</dd>
          </Fragment>
        ))}
      </dl>
    </Panel>
  );
}

const DEFENSE_LABELS = {
  resistance: "sheet.resistances",
  immunity: "sheet.immunities",
  vulnerability: "sheet.vulnerabilities",
} as const;

/** Resistances, immunities and vulnerabilities to damage. Hidden when there are none. */
export function Defenses() {
  const s = sheet.value;
  if (!s) return null;
  const kinds = (["resistance", "immunity", "vulnerability"] as const).filter(
    (kind) => s.defenses[kind].length > 0,
  );
  if (kinds.length === 0) return null;
  const damage = (type: string) => {
    const key = `hb.o.${type}` as UiKey;
    return ui(key) === key ? type : ui(key);
  };
  return (
    <Panel title={ui("sheet.defenses")}>
      <dl class="pairs">
        {kinds.map((kind) => (
          <Fragment key={kind}>
            <dt>{ui(DEFENSE_LABELS[kind])}</dt>
            <dd>{s.defenses[kind].map(damage).join(", ")}</dd>
          </Fragment>
        ))}
      </dl>
    </Panel>
  );
}

/** Traits from the species and subspecies. */
export function SpeciesTraits() {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s || s.traits.length === 0) return null;
  return (
    <Panel title={ui("sheet.speciesTraits")}>
      {s.traits.map((id) => (
        <RulesText key={id} name={c.name(id)} text={c.text(id, "desc")} />
      ))}
    </Panel>
  );
}

/** Feats the character took, each with its text one tap away. */
export function Feats() {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s || s.feats.length === 0) return null;
  return (
    <Panel title={ui("sheet.feats")}>
      {s.feats.map((id) => (
        <RulesText key={id} name={c.name(id)} text={c.text(id, "desc")} />
      ))}
    </Panel>
  );
}

/** Items carried and how heavy they are. */
export function Inventory() {
  const c = content.value;
  const s = sheet.value;
  const ch = character.value;
  if (!c || !s || ch.inventory.length === 0) return null;
  return (
    <Panel title={ui("sheet.inventory")}>
      <ul>
        {ch.inventory.map((i) => (
          <li key={i.itemId}>
            {c.name(i.itemId)}
            {i.quantity > 1 && ` ×${i.quantity}`}
          </li>
        ))}
      </ul>
      <p class="muted">
        {ui("sheet.load", { carried: weight(s.load.carried), capacity: weight(s.load.capacity) })}
      </p>
    </Panel>
  );
}

/** Problems the engine noticed, in plain words. */
export function Notes() {
  const c = content.value;
  const s = sheet.value;
  const ch = character.value;
  if (!c || !s || s.warnings.length === 0) return null;

  /** Warning params are ids, ability ids or numbers; ids become names, abilities abbreviations. */
  const format = (w: Warning) => {
    const params = Object.fromEntries(
      Object.entries(w.params).map(([key, value]) => {
        if (key === "ability")
          return [key, c.text(`${ch.ruleset}:ability/${value}`, "abbreviation") ?? value];
        const isId = typeof value === "string" && /^[a-z0-9]+:[a-z]+\//.test(value);
        return [key, isId ? c.name(value) : value];
      }),
    );
    return ui(`warning.${w.code}` as UiKey, params);
  };

  return (
    <Panel title={ui("sheet.warnings")}>
      <ul class="warnings">
        {s.warnings.map((w) => {
          const text = format(w);
          return <li key={text}>{text}</li>;
        })}
      </ul>
    </Panel>
  );
}
