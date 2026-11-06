import { rollCheck } from "../../app/play";
import { character, content, sheet } from "../../app/store";
import { signed, ui } from "../../i18n/ui";
import { distance } from "../../i18n/units";
import { ExplainButton } from "../Explain";

/**
 * The numbers a player looks for all the time, in a strip that stays under the tabs on a wide
 * screen: armor class, initiative, speed, passive Perception, proficiency bonus and, for a caster,
 * the save DC and the attack bonus of the spells. On a phone the bar of the play head has the
 * armor class and the initiative, and this strip is not shown.
 */
export function QuickStats() {
  const s = sheet.value;
  const c = content.value;
  const play = character.value.play;
  if (!s || !c) return null;
  // In the shape of a beast the armor class is the beast's.
  const shape = play.wildShape;
  const beastAc = shape
    ? (c.index.get(shape.monster)?.data.armorClass as { value: number }[] | undefined)?.[0]?.value
    : undefined;
  const caster = s.spellcasters[0];

  return (
    <div class="play-quick">
      {beastAc !== undefined ? (
        <span class="ps-stat">
          <small>{ui("play.ac")}</small>
          <b>{beastAc}</b>
        </span>
      ) : (
        <ExplainButton class="ps-stat" target={{ kind: "ac" }}>
          <small>{ui("play.ac")}</small>
          <b>{s.armorClass.value}</b>
        </ExplainButton>
      )}
      <button
        type="button"
        class="ps-stat ps-roll"
        onClick={() => rollCheck(ui("play.initiative"), s.initiative)}
      >
        <small>{ui("play.initiative")}</small>
        <b>{signed(s.initiative)}</b>
      </button>
      <ExplainButton class="ps-stat" target={{ kind: "speed" }}>
        <small>{ui("sheet.speed")}</small>
        <b>{s.speed === undefined ? "—" : distance(s.speed)}</b>
      </ExplainButton>
      <span class="ps-stat">
        <small>{ui("sheet.passivePerception")}</small>
        <b>{s.passivePerception}</b>
      </span>
      <span class="ps-stat">
        <small>{ui("sheet.proficiencyBonus")}</small>
        <b>{signed(s.proficiencyBonus)}</b>
      </span>
      {caster && (
        <>
          <span class="ps-stat">
            <small>{ui("sheet.spellSaveDc")}</small>
            <b>{caster.saveDc}</b>
          </span>
          <span class="ps-stat">
            <small>{ui("sheet.spellAttack")}</small>
            <b>{signed(caster.attackBonus)}</b>
          </span>
        </>
      )}
    </div>
  );
}
