import { signal } from "@preact/signals";
import type { PlayState } from "../engine/character";
import {
  type D20Mode,
  type D20Roll,
  type DiceRoll,
  parseDice,
  rollD20,
  rollExpression,
} from "../engine/dice";
import { sheet, updateCharacter } from "./store";

/** Edits the play state of the open character and saves it like any other change. */
export function changePlay(edit: (play: PlayState) => PlayState) {
  updateCharacter((draft) => {
    draft.play = edit(draft.play);
  });
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

/** How d20 checks are rolled until the player changes it. */
export const rollMode = signal<D20Mode>("normal");

export function addLog(entry: Omit<LogEntry, "id">) {
  rollLog.value = [{ id: nextId++, ...entry }, ...rollLog.value].slice(0, MAX_LOG);
}

export function clearLog() {
  rollLog.value = [];
}

const signedBonus = (n: number) => (n === 0 ? "" : n > 0 ? ` +${n}` : ` ${n}`);

/** Rolls a d20 with a bonus in the current mode and records it. */
export function rollCheck(label: string, bonus: number): D20Roll {
  const roll = rollD20(bonus, rollMode.value);
  const faces = roll.dice.length > 1 ? `[${roll.dice.join(", ")}] → ${roll.used}` : `${roll.used}`;
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
