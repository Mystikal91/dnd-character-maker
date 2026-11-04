import { signal } from "@preact/signals";
import { addLog, changePlay, concentrationAlert, rollCheck, rollDiceText } from "../../app/play";
import { character, content, sheet } from "../../app/store";
import type { DerivedSheet } from "../../engine/derive";
import { doubleDice } from "../../engine/monsterRolls";
import { castSpell, endConcentration, slotsLeft, startConcentration } from "../../engine/play";
import { type SpellRollData, spellRolls } from "../../engine/spellRolls";
import { signed, ui } from "../../i18n/ui";
import { damageLabel } from "../rules/ActionButtons";
import { Panel } from "../sheet/parts";
import { type SpellRow, collectSpellRows } from "../spellRows";
import { spellDetail } from "../spells/SpellInfo";
import { ChecksIcon, FocusIcon, HealIcon, SaveIcon } from "./icons";

/** The slot level the person chose to roll and cast a spell at, by spell (default: its own level). */
const slotChoice = signal<Record<string, number>>({});
/** The spell whose last attack was a critical hit: its damage rolls the dice twice, once. */
const criticalSpell = signal<string | undefined>(undefined);

const levelId = (level: number) => `spells-level-${level}`;

/** The slots of one level as small gems: filled while there are some left. */
function SlotDots({ level, s }: { level: number; s: DerivedSheet }) {
  const total = s.spellSlots[level - 1] ?? 0;
  if (total === 0) return null;
  const left = slotsLeft(character.value.play, level, total);
  return (
    <span class="slot-dots" role="img" aria-label={ui("play.slotsLeft", { left, total })}>
      {Array.from({ length: total }, (_, i) => (
        <i key={`${level}-${i + 1}`} class={i < left ? "on" : ""} />
      ))}
    </span>
  );
}

/** The spell a person is keeping their mind on, and the save that may break it. */
function ConcentrationBanner({ spell }: { spell: string }) {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s) return null;
  const alert = concentrationAlert.value;
  const conSave = s.saves.con.bonus;
  return (
    <div class="spell-focus" aria-live="polite">
      <FocusIcon />
      <div class="spell-focus-text">
        <small>{ui("play.concentrationLabel")}</small>
        <b>{c.name(spell)}</b>
        {alert !== undefined && (
          <span class="spell-focus-alert">{ui("play.concentrationCheck", { dc: alert })}</span>
        )}
      </div>
      {alert !== undefined && (
        <button
          type="button"
          class="card-btn"
          onClick={() => rollCheck(`${c.name(spell)} - ${ui("play.concentrationSave")}`, conSave)}
        >
          {ui("play.concentrationRoll")} {signed(conSave)}
        </button>
      )}
      <button
        type="button"
        class="card-btn"
        onClick={() => {
          concentrationAlert.value = undefined;
          changePlay((p) => endConcentration(p));
        }}
      >
        {ui("play.concentrationEnd")}
      </button>
    </div>
  );
}

/** One spell: its name (tap for the text), what it is, and the buttons to cast it and roll it. */
function SpellCard({ row, s }: { row: SpellRow; s: DerivedSheet }) {
  const c = content.value;
  if (!c) return null;
  const { id, level } = row;
  const play = character.value.play;
  const data = (c.index.get(id)?.data ?? {}) as SpellRollData & {
    classes?: string[];
    school?: string;
    concentration?: boolean;
    ritual?: boolean;
  };
  const name = c.name(id);
  const caster = s.spellcasters.find((x) => data.classes?.includes(x.classId)) ?? s.spellcasters[0];
  const modifier = caster ? s.abilities[caster.ability].modifier : 0;

  // A bigger slot only matters to the spells that grow with it.
  const slotLevels = (level > 0 ? s.spellSlots.map((n, i) => (n > 0 ? i + 1 : 0)) : []).filter(
    (l) => l >= level,
  );
  const picked = slotChoice.value[id] ?? level;
  const slotLevel = slotLevels.includes(picked) ? picked : level;
  const rolls = spellRolls(data, {
    slotLevel,
    characterLevel: s.level,
    modifier,
    bonus: s.spellDamage[id] ?? 0,
  });
  const choosing = rolls.scalesBySlot && slotLevels.length > 1;
  const castLevel = rolls.scalesBySlot ? slotLevel : level;

  const concentrating = play.concentration === id;
  const critical = criticalSpell.value === id;
  const school = data.school ? c.name(`${character.value.ruleset}:school/${data.school}`) : "";
  // "1 reaction, which you take when..." is long: the first words say how long it takes.
  const time = c.text(id, "castingTime")?.split(",")[0];

  const hasActions =
    level > 0 ||
    rolls.attack ||
    rolls.damage.length > 0 ||
    rolls.heal !== undefined ||
    rolls.save !== undefined ||
    data.concentration === true;

  const cast = () => {
    const done = castSpell(play, castLevel, s.spellSlots, s.pactSlots);
    if (!done) {
      addLog({ label: name, detail: ui("play.noSlot") });
      return;
    }
    changePlay(() => done.play);
    addLog({
      label: name,
      detail: ui(done.slot.kind === "pact" ? "play.castPact" : "play.castSlot", {
        level: done.slot.level,
      }),
    });
  };

  return (
    <li
      class="play-card spell-card"
      data-school={data.school ?? ""}
      data-focus={concentrating ? "on" : undefined}
    >
      <span class="card-badge" aria-hidden="true">
        {level === 0 ? "✦" : level}
      </span>
      <div class="card-head">
        <button
          type="button"
          class="link card-name"
          aria-label={`${ui("spells.info")}: ${name}`}
          onClick={() => {
            spellDetail.value = id;
          }}
        >
          {name}
        </button>
        <span class="card-meta">
          {[school, time].filter(Boolean).join(" · ")}
          {data.concentration && <abbr title={ui("spells.concentration")}>C</abbr>}
          {data.ritual && <abbr title={ui("spells.ritual")}>R</abbr>}
          {row.atWill && <abbr title={ui("spells.atWill")}>∞</abbr>}
        </span>
      </div>

      {choosing && (
        <div class="spell-slot-pick">
          <small>{ui("play.spellAtSlot")}</small>
          {slotLevels.map((l) => (
            <button
              key={l}
              type="button"
              class="card-btn spell-slot-btn"
              aria-label={`${ui("play.spellSlotChoice", { spell: name })}: ${l}`}
              aria-pressed={l === slotLevel}
              onClick={() => {
                slotChoice.value = { ...slotChoice.value, [id]: l };
              }}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {hasActions && (
        <div class="card-actions">
          {level > 0 && (
            <button type="button" class="card-btn card-primary" onClick={cast}>
              {ui("play.cast")}
            </button>
          )}
          {rolls.attack && caster && (
            <button
              type="button"
              class="card-btn card-roll card-attack"
              onClick={() => {
                const roll = rollCheck(`${name} - ${ui("play.spellAttack")}`, caster.attackBonus);
                criticalSpell.value = roll.critical ? id : undefined;
              }}
            >
              <ChecksIcon />
              <span>{ui("play.spellAttack")}</span>
              <b>{signed(caster.attackBonus)}</b>
            </button>
          )}
          {rolls.damage.map((part) => {
            const dice = critical ? doubleDice(part.dice) : part.dice;
            return (
              <button
                key={`${part.type}${part.dice}`}
                type="button"
                class="card-btn card-roll card-damage"
                data-damage={part.type}
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
              class="card-btn card-roll card-heal"
              onClick={() => {
                if (rolls.heal) rollDiceText(`${name} - ${ui("play.spellHeal")}`, rolls.heal);
              }}
            >
              <HealIcon />
              <span>{ui("play.spellHealDice", { dice: rolls.heal })}</span>
            </button>
          )}
          {rolls.save && caster && (
            <span class="spell-save">
              <SaveIcon />
              {ui("play.spellSave", {
                dc: caster.saveDc,
                ability: c.name(`${character.value.ruleset}:ability/${rolls.save}`),
              })}
            </span>
          )}
          {data.concentration === true && (
            <button
              type="button"
              class="card-btn spell-focus-btn"
              aria-pressed={concentrating}
              onClick={() => {
                concentrationAlert.value = undefined;
                changePlay((p) =>
                  concentrating ? endConcentration(p) : startConcentration(p, id),
                );
              }}
            >
              <FocusIcon />
              <span>{ui("play.concentrate")}</span>
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/** The spells the character can cast, by level, as cards with what to tap at the table. */
export function PlaySpells() {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s) return null;
  const rows = collectSpellRows(c, s);
  if (rows.length === 0) return null;
  const levels = [...new Set(rows.map((r) => r.level))];
  const concentrating = character.value.play.concentration;

  return (
    <Panel title={ui("play.spells")} className="spells-panel">
      {concentrating && <ConcentrationBanner spell={concentrating} />}
      {levels.length > 2 && (
        <nav class="spell-jump" aria-label={ui("play.spellJump")}>
          {levels.map((level) => (
            <button
              key={level}
              type="button"
              class="card-btn spell-jump-btn"
              onClick={() =>
                document.getElementById(levelId(level))?.scrollIntoView({ block: "start" })
              }
            >
              {level === 0 ? "✦" : level}
            </button>
          ))}
        </nav>
      )}
      {levels.map((level) => (
        <section key={level} id={levelId(level)} class="spell-group">
          <header class="spell-group-head">
            <h4>{level === 0 ? ui("spells.cantrips") : ui("spells.level", { level })}</h4>
            <SlotDots level={level} s={s} />
          </header>
          <ul class="plain spell-cards">
            {rows
              .filter((r) => r.level === level)
              .map((row) => (
                <SpellCard key={row.id} row={row} s={s} />
              ))}
          </ul>
        </section>
      ))}
    </Panel>
  );
}
