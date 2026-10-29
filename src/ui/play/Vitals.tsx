import { useState } from "preact/hooks";
import { addLog, changePlay, damageCharacter, vitals } from "../../app/play";
import { character, sheet } from "../../app/store";
import { canKeepAwake, keepAwake, setKeepAwake } from "../../app/wakeLock";
import { cryptoRandomInt } from "../../engine/dice";
import {
  applyHealing,
  currentHp,
  deathStatus,
  gainTempHp,
  hitDiceLeft,
  longRest,
  setDeathSave,
  shortRest,
  spendHitDie,
} from "../../engine/play";
import { type UiKey, ui } from "../../i18n/ui";
import { Roll } from "../Roll";
import { Panel } from "../sheet/parts";

export function HitPoints() {
  const [amount, setAmount] = useState("");
  const v = vitals();
  const play = character.value.play;
  if (!v) return null;
  const hp = currentHp(play, v.max);
  const n = Math.max(0, Number.parseInt(amount, 10) || 0);
  const apply = (change: (amount: number) => void) => {
    if (n === 0) return;
    change(n);
    setAmount("");
  };
  const percent = v.max > 0 ? Math.round((hp / v.max) * 100) : 0;

  return (
    <Panel title={ui("play.hitPoints")}>
      <output class="hp-readout">
        <Roll as="b" class={hp === 0 ? "zero" : ""}>
          {hp}
        </Roll>
        <span>{ui("play.of", { max: v.max })}</span>
        {play.tempHp > 0 && <em>{ui("play.temp", { n: play.tempHp })}</em>}
      </output>
      <div
        class="hp-bar"
        data-state={hp === 0 ? "down" : percent <= 25 ? "low" : percent <= 50 ? "hurt" : "well"}
        role="img"
        aria-label={`${hp} ${ui("play.of", { max: v.max })}`}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <div class="hp-quick">
        {[10, 5, 1].map((a) => (
          <button
            type="button"
            key={`d${a}`}
            class="danger-btn"
            aria-label={ui("play.damageBy", { n: a })}
            onClick={() => damageCharacter(a)}
          >
            {"\u2212"}
            {a}
          </button>
        ))}
        {[1, 5, 10].map((a) => (
          <button
            type="button"
            key={`h${a}`}
            aria-label={ui("play.healBy", { n: a })}
            onClick={() => changePlay((p) => applyHealing(p, v.max, a))}
          >
            +{a}
          </button>
        ))}
      </div>
      <div class="hp-controls">
        <label class="field">
          <span>{ui("play.amount")}</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={amount}
            onInput={(e) => setAmount(e.currentTarget.value)}
          />
        </label>
        <div class="btn-row">
          <button
            type="button"
            class="danger-btn"
            disabled={n === 0}
            onClick={() => apply(damageCharacter)}
          >
            {ui("play.damage")}
          </button>
          <button
            type="button"
            disabled={n === 0}
            onClick={() => apply((a) => changePlay((p) => applyHealing(p, v.max, a)))}
          >
            {ui("play.heal")}
          </button>
          <button
            type="button"
            disabled={n === 0}
            onClick={() => apply((a) => changePlay((p) => gainTempHp(p, a)))}
          >
            {ui("play.tempHp")}
          </button>
        </div>
      </div>
    </Panel>
  );
}

export function DeathSaves() {
  const v = vitals();
  const play = character.value.play;
  if (!v) return null;
  const status = deathStatus(play, v.max);
  if (status === "alive" && play.deathSaves.successes === 0 && play.deathSaves.failures === 0)
    return null;

  const row = (kind: "successes" | "failures", label: UiKey) => (
    <div class="death-row">
      <span>{ui(label)}</span>
      <span class="pips-btns">
        {[1, 2, 3].map((n) => {
          const on = play.deathSaves[kind] >= n;
          return (
            <button
              type="button"
              key={n}
              class={`pip-btn${on ? " on" : ""}`}
              aria-pressed={on}
              aria-label={`${ui(label)} ${n}`}
              onClick={() =>
                changePlay((p) => setDeathSave(p, kind, p.deathSaves[kind] === n ? n - 1 : n))
              }
            />
          );
        })}
      </span>
    </div>
  );

  return (
    <Panel title={ui("play.deathSaves")}>
      {status !== "alive" && (
        <p class={`status status-${status}`}>{ui(`play.status.${status}` as UiKey)}</p>
      )}
      {row("successes", "play.successes")}
      {row("failures", "play.failures")}
    </Panel>
  );
}

export function HitDice() {
  const v = vitals();
  const play = character.value.play;
  if (!v) return null;
  const dice = Object.entries(v.hitDice);
  if (dice.length === 0) return null;

  return (
    <Panel title={ui("play.hitDice")}>
      <ul class="plain">
        {dice.map(([die, total]) => {
          const left = hitDiceLeft(play, die, total);
          return (
            <li class="row-between" key={die}>
              <span>
                <b>{die}</b> <span class="muted">{ui("play.hitDiceLeft", { left, total })}</span>
              </span>
              <button
                type="button"
                disabled={left === 0}
                onClick={() => {
                  const rolled = 1 + cryptoRandomInt(Number(die.slice(1)));
                  const heal = Math.max(0, rolled + v.conMod);
                  changePlay((p) => spendHitDie(p, v.max, die, rolled, v.conMod));
                  addLog({
                    label: `${ui("play.hitDice")} ${die}`,
                    detail: `${die} ${rolled}${v.conMod === 0 ? "" : v.conMod > 0 ? ` +${v.conMod}` : ` ${v.conMod}`} → ${ui("play.healedBy", { n: heal })}`,
                    total: heal,
                  });
                }}
              >
                {ui("play.spendDie")}
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function Rests() {
  const v = vitals();
  const s = sheet.value;
  const ch = character.value;
  if (!v || !s) return null;
  // A lone warlock gets every slot back; a multiclass warlock only the separate pact slots.
  const onlyWarlock = s.spellcasters.length === 1 && s.spellcasters[0]?.pact;
  const recovers = s.pactSlots ? "pact" : onlyWarlock ? "all" : "none";

  return (
    <Panel title={ui("play.rests")}>
      <p class="muted">{ui("play.shortRestHint")}</p>
      <div class="btn-row">
        <button
          type="button"
          onClick={() => {
            changePlay((p) =>
              shortRest(
                p,
                recovers,
                s.resources.filter((r) => r.recovery === "short").map((r) => r.id),
              ),
            );
            addLog({ label: ui("play.shortRestLog"), detail: "" });
          }}
        >
          {ui("play.shortRest")}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!confirm(ui("play.longRestConfirm"))) return;
            changePlay((p) => longRest(p, v.hitDice));
            addLog({ label: ui("play.longRestLog"), detail: "" });
          }}
        >
          {ui("play.longRest")}
        </button>
      </div>
      <div class="rest-opts">
        <label class="check-row">
          <input
            type="checkbox"
            checked={ch.play.inspiration}
            onChange={(e) => changePlay((p) => ({ ...p, inspiration: e.currentTarget.checked }))}
          />
          {ui("play.inspiration")}
        </label>
        {canKeepAwake && (
          <label class="check-row">
            <input
              type="checkbox"
              checked={keepAwake.value}
              onChange={(e) => void setKeepAwake(e.currentTarget.checked)}
            />
            {ui("play.keepAwake")}
          </label>
        )}
      </div>
    </Panel>
  );
}

/** Hit points, death saves, hit dice and rests: what changes most during a session. */
export function Vitals() {
  return (
    <>
      <HitPoints />
      <DeathSaves />
      <HitDice />
      <Rests />
    </>
  );
}
