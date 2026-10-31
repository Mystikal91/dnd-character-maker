import { signal } from "@preact/signals";
import type { PlayState } from "../engine/character";
import {
  type D20Mode,
  type D20Options,
  type D20Roll,
  type DiceRoll,
  parseDice,
  rollD20,
  rollExpression,
} from "../engine/dice";
import { healingOf, useOne } from "../engine/gear";
import {
  applyDamage,
  applyHealing,
  concentrationDc,
  currentHp,
  deathStatus,
  endConcentration,
} from "../engine/play";
import { ui } from "../i18n/ui";
import { character, content, sheet, updateCharacter } from "./store";

/** The hit points before the last change, to take it back for a few seconds. */
export const hpUndo = signal<{ before: PlayState; change: number } | undefined>(undefined);
let undoTimer: ReturnType<typeof setTimeout> | undefined;
const UNDO_MS = 10_000;
/** Changes this close together (a held button, quick taps) are taken back as one. */
const BURST_MS = 1_500;
let lastChangeAt = 0;

/** Edits the play state of the open character and saves it like any other change. */
export function changePlay(edit: (play: PlayState) => PlayState, options: { undo?: boolean } = {}) {
  let remembered: { before: PlayState; change: number } | undefined;
  updateCharacter((draft) => {
    const before = draft.play;
    const after = edit(before);
    const max = vitals()?.max ?? 0;
    const change = currentHp(after, max) - currentHp(before, max);
    if (options.undo !== false && (change !== 0 || after.tempHp !== before.tempHp))
      remembered = {
        before: structuredClone(before),
        change: change || after.tempHp - before.tempHp,
      };
    draft.play = after;
  });
  if (options.undo === false) hpUndo.value = undefined;
  else if (remembered) {
    const now = Date.now();
    const earlier = hpUndo.value;
    hpUndo.value =
      earlier && now - lastChangeAt < BURST_MS
        ? { before: earlier.before, change: earlier.change + remembered.change }
        : remembered;
    lastChangeAt = now;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => {
      hpUndo.value = undefined;
    }, UNDO_MS);
  }
}

/** Takes back the last change of hit points. */
export function undoHp() {
  const last = hpUndo.value;
  if (!last) return;
  clearTimeout(undoTimer);
  changePlay(() => last.before, { undo: false });
}

export interface LogEntry {
  id: number;
  label: string;
  /** How the total came about, e.g. `d20 [14, 7] → 14 +5`. */
  detail: string;
  total?: number;
  tone?: "critical" | "fumble";
}

const MAX_LOG = 40;
let nextId = 1;

/** Recent rolls, newest first. Kept in memory only: a roll history is not part of the character. */
export const rollLog = signal<LogEntry[]>([]);

/** The Constitution save DC the player owes after damage broke their concentration, if any. */
export const concentrationAlert = signal<number | undefined>(undefined);

/** The weapon whose next damage roll counts as a critical hit (dice doubled), if any. */
export const criticalWeapon = signal<string | undefined>(undefined);

/** The last attack was a critical hit, so the extra damage rolls double their dice. */
export const criticalExtra = signal(false);

/** The barbarian is raging: the rage bonus is added to melee damage rolls. */
export const raging = signal(false);

/** How d20 checks are rolled until the player changes it. */
export const rollMode = signal<D20Mode>("normal");

export function addLog(entry: Omit<LogEntry, "id">) {
  // A short buzz on phones that have one, longer for a natural 20.
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function")
    navigator.vibrate(entry.tone === "critical" ? [20, 40, 20] : 12);
  rollLog.value = [{ id: nextId++, ...entry }, ...rollLog.value].slice(0, MAX_LOG);
}

export function clearLog() {
  rollLog.value = [];
}

const signedBonus = (n: number) => (n === 0 ? "" : n > 0 ? ` +${n}` : ` ${n}`);

/** Rolls a d20 with a bonus in the current mode and records it. */
export function rollCheck(label: string, bonus: number, options?: D20Options): D20Roll {
  const roll = rollD20(bonus, rollMode.value, undefined, options);
  const faces =
    roll.dice.length > 1
      ? `[${roll.dice.join(", ")}] → ${roll.used}`
      : roll.used !== roll.natural
        ? `${roll.natural} → ${roll.used}`
        : `${roll.used}`;
  addLog({
    label,
    detail: `d20 ${faces}${signedBonus(bonus)}`,
    total: roll.total,
    ...(roll.critical && { tone: "critical" as const }),
    ...(roll.fumble && { tone: "fumble" as const }),
  });
  return roll;
}

/** Rolls dice like `2d6+3` and records it. Returns undefined when the text is not a dice expression. */
export function rollDiceText(label: string, text: string): DiceRoll | undefined {
  const parsed = parseDice(text);
  if (!parsed) return undefined;
  const roll = rollExpression(parsed);
  const faces = roll.rolls.map((group) => `[${group.join(", ")}]`).join(" + ");
  addLog({ label, detail: `${faces}${signedBonus(roll.modifier)}`, total: roll.total });
  return roll;
}

/** Hit points and the numbers the play screen needs, or undefined before the sheet exists. */
export function vitals() {
  const s = sheet.value;
  return s
    ? { max: s.hitPoints.max, hitDice: s.hitPoints.hitDice, conMod: s.abilities.con.modifier }
    : undefined;
}

/**
 * Uses up one of an item. A potion that says what it heals is rolled and the hit points are
 * restored; any other item only goes down by one and the log says it was used.
 */
export function useItem(itemId: string) {
  const c = content.value;
  const found = character.value.inventory.find((i) => i.itemId === itemId);
  if (!c || !found) return;
  const name = found.custom?.name ?? c.name(itemId);
  const heal = healingOf(c.index.get(itemId));
  updateCharacter((draft) => {
    useOne(draft.inventory, itemId);
  });
  const v = vitals();
  const roll = heal && v ? rollDiceText(name, heal) : undefined;
  if (roll && v) {
    changePlay((p) => applyHealing(p, v.max, roll.total));
    return;
  }
  addLog({ label: ui("play.used", { name }), detail: "" });
}

/**
 * Damage to the open character, with what it does to concentration: the save to make, or the end
 * of it when the character falls unconscious.
 */
export function damageCharacter(amount: number) {
  const v = vitals();
  if (!v || amount <= 0) return;
  const play = character.value.play;
  const concentrating = Boolean(play.concentration);
  const after = applyDamage(play, v.max, amount);
  if (concentrating && deathStatus(after, v.max) !== "alive") {
    changePlay((p) => endConcentration(applyDamage(p, v.max, amount)));
  } else {
    changePlay((p) => applyDamage(p, v.max, amount));
    if (concentrating) concentrationAlert.value = concentrationDc(amount);
  }
}
