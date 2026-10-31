import { character, content, shownSheet } from "../../app/store";
import { ABILITIES } from "../../data/schema";
import { signed, ui } from "../../i18n/ui";
import { ExplainButton } from "../Explain";
import { Roll } from "../Roll";
import { Pip } from "./parts";

/** Proficiency bonus and passive senses, as three round badges. */
export function Badges() {
  const c = content.value;
  const s = shownSheet.value;
  const ch = character.value;
  if (!c || !s) return null;
  const insight = s.skills.find((sk) => sk.id === `${ch.ruleset}:skill/insight`);

  return (
    <div class="badges">
      <div class="badge">
        <b>{signed(s.proficiencyBonus)}</b>
        <span>{ui("sheet.proficiencyBonus")}</span>
      </div>
      <div class="badge">
        <b>{s.passivePerception}</b>
        <span>{ui("sheet.passivePerception")}</span>
      </div>
      <div class="badge">
        <b>{10 + (insight?.bonus ?? s.abilities.wis.modifier)}</b>
        <span>{ui("sheet.passiveInsight")}</span>
      </div>
    </div>
  );
}

/** Each ability with its score, modifier, saving throw and the skills that use it. */
export function AbilityBlocks() {
  const c = content.value;
  const s = shownSheet.value;
  const ch = character.value;
  if (!c || !s) return null;
  const ruleset = ch.ruleset;

  return (
    <div class="ability-blocks">
      {ABILITIES.map((a) => {
        const skills = s.skills
          .filter((sk) => sk.ability === a)
          .sort((x, y) => c.name(x.id).localeCompare(c.name(y.id)));
        return (
          <section class="card ability-block" key={a}>
            <div class="ability-core">
              <div class="ability-name">{c.name(`${ruleset}:ability/${a}`)}</div>
              <Roll class="ability-oval" as="div">
                {s.abilities[a].score}
              </Roll>
              <Roll class="ability-mod" as="div">
                {signed(s.abilities[a].modifier)}
              </Roll>
            </div>
            <ul class="checks">
              <li class={s.saves[a].proficient ? "proficient" : ""}>
                <ExplainButton target={{ kind: "save", ability: a }}>
                  <Pip on={s.saves[a].proficient} />
                  <b class="bonus">{signed(s.saves[a].bonus)}</b>
                  {ui("sheet.savingThrow")}
                </ExplainButton>
              </li>
              {skills.map((sk) => (
                <li key={sk.id} class={sk.proficient ? "proficient" : ""}>
                  <ExplainButton target={{ kind: "skill", id: sk.id }}>
                    <Pip on={sk.proficient} />
                    <b class="bonus">{signed(sk.bonus)}</b>
                    {c.name(sk.id)}
                  </ExplainButton>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
