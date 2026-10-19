import { useState } from "preact/hooks";
import {
  type LogEntry,
  clearLog,
  criticalWeapon,
  rollCheck,
  rollDiceText,
  rollLog,
  rollMode,
} from "../../app/play";
import { content, sheet } from "../../app/store";
import { ABILITIES } from "../../data/schema";
import { type D20Mode, doubleDice } from "../../engine/dice";
import { type UiKey, signed, ui } from "../../i18n/ui";
import { Panel } from "../sheet/parts";

const MODES: D20Mode[] = ["normal", "advantage", "disadvantage"];
const DICE = [4, 6, 8, 10, 12, 20, 100];

function RollButton({
  label,
  bonus,
  name = label,
}: {
  label: string;
  bonus: number;
  name?: string;
}) {
  return (
    <button type="button" class="roll-btn" onClick={() => rollCheck(name, bonus)}>
      <span>{label}</span>
      <b>{signed(bonus)}</b>
    </button>
  );
}

/** Advantage, disadvantage or a normal roll for every d20 check below. */
function ModePicker() {
  const mode = rollMode.value;
  return (
    <fieldset class="segmented">
      <legend class="sr-only">{ui("play.mode")}</legend>
      {MODES.map((m) => (
        <button
          type="button"
          key={m}
          class={mode === m ? "on" : ""}
          aria-pressed={mode === m}
          onClick={() => {
            rollMode.value = m;
          }}
        >
          {ui(`play.mode.${m}` as UiKey)}
        </button>
      ))}
    </fieldset>
  );
}

/** Checks, saves, skills and attacks that roll with one tap. */
export function QuickRolls() {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s) return null;
  const ruleset = "srd51";
  const skills = [...s.skills].sort((a, b) => c.name(a.id).localeCompare(c.name(b.id)));

  return (
    <Panel title={ui("play.rolls")}>
      <ModePicker />
      <h4>{ui("play.initiative")}</h4>
      <div class="roll-grid">
        <RollButton label={ui("play.initiative")} bonus={s.initiative} />
      </div>
      <h4>{ui("play.saves")}</h4>
      <div class="roll-grid">
        {ABILITIES.map((a) => (
          <RollButton
            key={a}
            label={c.text(`${ruleset}:ability/${a}`, "abbreviation") ?? a}
            name={`${c.name(`${ruleset}:ability/${a}`)} - ${ui("sheet.savingThrow")}`}
            bonus={s.saves[a].bonus}
          />
        ))}
      </div>
      <h4>{ui("play.skills")}</h4>
      <div class="roll-grid">
        {skills.map((sk) => (
          <RollButton key={sk.id} label={c.name(sk.id)} bonus={sk.bonus} />
        ))}
      </div>
      {s.attacks.length > 0 && (
        <>
          <h4>{ui("play.attacks")}</h4>
          <ul class="plain">
            {s.attacks.map((a) => {
              const dmg = a.damage;
              const dice = dmg
                ? `${dmg.dice}${dmg.bonus === 0 ? "" : dmg.bonus > 0 ? `+${dmg.bonus}` : dmg.bonus}`
                : "";
              return (
                <li class="row-between" key={a.itemId}>
                  <span>{c.name(a.itemId)}</span>
                  <span class="btn-row">
                    <button
                      type="button"
                      class="roll-btn"
                      onClick={() => {
                        const roll = rollCheck(
                          `${c.name(a.itemId)} - ${ui("play.attackRoll")}`,
                          a.attackBonus,
                        );
                        // A natural 20 arms the critical damage; any other attack clears it.
                        if (roll.critical) criticalWeapon.value = a.itemId;
                        else if (criticalWeapon.value === a.itemId)
                          criticalWeapon.value = undefined;
                      }}
                    >
                      <span>{ui("play.attackRoll")}</span>
                      <b>{signed(a.attackBonus)}</b>
                    </button>
                    {dmg && (
                      <button
                        type="button"
                        class="roll-btn"
                        onClick={() => {
                          const critical = criticalWeapon.value === a.itemId;
                          const text = critical ? (doubleDice(dice) ?? dice) : dice;
                          const name = `${c.name(a.itemId)} - ${ui("play.damageRoll")}`;
                          rollDiceText(
                            critical ? `${name} (${ui("play.criticalDamage")})` : name,
                            text,
                          );
                          if (critical) criticalWeapon.value = undefined;
                        }}
                      >
                        <span>{ui("play.damageRoll")}</span>
                        <b>
                          {criticalWeapon.value === a.itemId ? (doubleDice(dice) ?? dice) : dice}
                        </b>
                      </button>
                    )}
                    {dmg && (
                      <label class="check-row crit-toggle">
                        <input
                          type="checkbox"
                          checked={criticalWeapon.value === a.itemId}
                          onChange={(e) => {
                            criticalWeapon.value = e.currentTarget.checked ? a.itemId : undefined;
                          }}
                        />
                        {ui("play.criticalHit")}
                      </label>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Panel>
  );
}

/** Plain dice and a box for expressions like 2d6+3. */
export function DiceTray() {
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);

  const submit = () => {
    if (!text.trim()) return;
    const ok = rollDiceText(text.trim(), text);
    setInvalid(!ok);
    if (ok) setText("");
  };

  return (
    <Panel title={ui("play.dice")}>
      <div class="dice-row">
        {DICE.map((sides) => (
          <button
            type="button"
            class="die"
            key={sides}
            onClick={() => rollDiceText(`d${sides}`, `d${sides}`)}
          >
            d{sides}
          </button>
        ))}
      </div>
      <form
        class="dice-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label class="field">
          <span>{ui("play.customDice")}</span>
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            placeholder={ui("play.customPlaceholder")}
            value={text}
            aria-invalid={invalid}
            onInput={(e) => {
              setText(e.currentTarget.value);
              setInvalid(false);
            }}
          />
        </label>
        <button type="submit">{ui("play.roll")}</button>
      </form>
      {invalid && (
        <p class="note" role="alert">
          {ui("play.invalidDice")}
        </p>
      )}
    </Panel>
  );
}

function LogLine({ entry }: { entry: LogEntry }) {
  return (
    <li class={entry.tone ?? ""}>
      <span class="log-label">{entry.label}</span>
      {entry.detail && <span class="muted log-detail">{entry.detail}</span>}
      {entry.total !== undefined && <b class="log-total">{entry.total}</b>}
      {entry.tone && <em>{entry.tone === "critical" ? ui("play.critical") : ui("play.fumble")}</em>}
    </li>
  );
}

/** The latest rolls, newest first. */
export function RollHistory() {
  const log = rollLog.value;
  return (
    <Panel title={ui("play.log")}>
      {log.length === 0 ? (
        <p class="muted">{ui("play.logEmpty")}</p>
      ) : (
        <>
          <ol class="roll-log">
            {log.map((entry) => (
              <LogLine key={entry.id} entry={entry} />
            ))}
          </ol>
          <button type="button" class="link" onClick={clearLog}>
            {ui("play.clearLog")}
          </button>
        </>
      )}
    </Panel>
  );
}
