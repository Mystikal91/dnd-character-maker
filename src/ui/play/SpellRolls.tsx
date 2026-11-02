import { signal } from "@preact/signals";
import { rollCheck, rollDiceText } from "../../app/play";
import { character, content, sheet } from "../../app/store";
import { doubleDice } from "../../engine/monsterRolls";
import { type SpellRollData, spellRolls } from "../../engine/spellRolls";
import { signed, ui } from "../../i18n/ui";
import { damageLabel } from "../rules/ActionButtons";

/** The slot level the person chose to roll a spell at, by spell (it defaults to the spell's own level). */
const slotChoice = signal<Record<string, number>>({});
/** The spell whose last attack was a critical hit: its damage rolls the dice twice, once. */
const criticalSpell = signal<string | undefined>(undefined);

/**
 * Buttons to roll what a spell does, from the SRD data: the spell attack, the damage and the healing
 * (with the dice of the slot chosen, or of the level of the character for a cantrip), and the saving
 * throw the target makes against the save DC. A spell without that data has none of it.
 */
export function SpellRollButtons({ id, level }: { id: string; level: number }) {
  const c = content.value;
  const s = sheet.value;
  const data = c?.index.get(id)?.data as (SpellRollData & { classes?: string[] }) | undefined;
  if (!c || !s || !data) return null;
  const caster = s.spellcasters.find((x) => data.classes?.includes(x.classId)) ?? s.spellcasters[0];
  const modifier = caster ? s.abilities[caster.ability].modifier : 0;
  // A bigger slot only changes the dice for the spells that grow with it.
  const slotLevels = (level > 0 ? s.spellSlots.map((n, i) => (n > 0 ? i + 1 : 0)) : []).filter(
    (l) => l >= level,
  );
  const picked = slotChoice.value[id] ?? level;
  const slotLevel = slotLevels.includes(picked) ? picked : level;
  const rolls = spellRolls(data, { slotLevel, characterLevel: s.level, modifier });
  const hasRolls = rolls.attack || rolls.damage.length > 0 || rolls.heal !== undefined;
  if (!hasRolls && !rolls.save) return null;

  const name = c.name(id);
  const critical = criticalSpell.value === id;
  return (
    <span class="spell-rolls">
      {rolls.scalesBySlot && slotLevels.length > 1 && (
        <select
          class="chip"
          aria-label={ui("play.spellSlotChoice", { spell: name })}
          value={slotLevel}
          onChange={(e) => {
            slotChoice.value = { ...slotChoice.value, [id]: Number(e.currentTarget.value) };
          }}
        >
          {slotLevels.map((l) => (
            <option key={l} value={l}>
              {ui("sheet.slotLevel", { level: l })}
            </option>
          ))}
        </select>
      )}
      {rolls.attack && caster && (
        <button
          type="button"
          class="chip"
          onClick={() => {
            const roll = rollCheck(`${name} - ${ui("play.spellAttack")}`, caster.attackBonus);
            criticalSpell.value = roll.critical ? id : undefined;
          }}
        >
          {ui("play.spellAttack")} {signed(caster.attackBonus)}
        </button>
      )}
      {rolls.damage.map((part) => {
        const dice = critical ? doubleDice(part.dice) : part.dice;
        return (
          <button
            key={`${part.type}${part.dice}`}
            type="button"
            class="chip"
            onClick={() => {
              rollDiceText(`${name} (${damageLabel(part, dice)})`, dice);
              criticalSpell.value = undefined;
            }}
          >
            {damageLabel(part, dice)}
          </button>
        );
      })}
      {rolls.heal && (
        <button
          type="button"
          class="chip"
          onClick={() => {
            if (rolls.heal) rollDiceText(`${name} - ${ui("play.spellHeal")}`, rolls.heal);
          }}
        >
          {ui("play.spellHealDice", { dice: rolls.heal })}
        </button>
      )}
      {rolls.save && caster && (
        <span class="muted">
          {ui("play.spellSave", {
            dc: caster.saveDc,
            ability: c.name(`${character.value.ruleset}:ability/${rolls.save}`),
          })}
        </span>
      )}
    </span>
  );
}
