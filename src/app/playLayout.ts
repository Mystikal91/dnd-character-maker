import { signal } from "@preact/signals";

/**
 * How the person has arranged the panels of the Play screen. It belongs to the device (the screen
 * is what decides how a person wants it), so it lives in localStorage and not in the character.
 * `layouts` holds one arrangement for each number of columns the person has set themselves; a count
 * with none is worked out from another one, or by `columns.ts`.
 */
export type Count = 1 | 2 | 3;
export type Columns = string[][];

export interface PlayLayout {
  /** The columns wanted on a wide screen: a narrower one still gets what fits. */
  wanted: 2 | 3;
  layouts: Partial<Record<Count, Columns>>;
  /** Panels the person does not want to see. */
  hidden: string[];
}

/** Panels that cannot be hidden: without them the screen would be missing what a turn needs. */
export const ESSENTIAL: readonly string[] = [
  "hp",
  "death",
  "rage",
  "attacks",
  "checks",
  "slots",
  "spells",
  "rests",
];

export const canHide = (panel: string) => !ESSENTIAL.includes(panel);

export const EMPTY_LAYOUT: PlayLayout = { wanted: 3, layouts: {}, hidden: [] };

const KEY = "playLayout";

const isColumns = (v: unknown): v is Columns =>
  Array.isArray(v) &&
  v.every((col) => Array.isArray(col) && col.every((p) => typeof p === "string"));

/** Reads what was saved, trusting none of it: a layout from an older version or a damaged file. */
export function parseLayout(raw: unknown): PlayLayout {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const layouts: PlayLayout["layouts"] = {};
  const saved = (typeof r.layouts === "object" && r.layouts !== null ? r.layouts : {}) as Record<
    string,
    unknown
  >;
  for (const count of [1, 2, 3] as const) {
    const cols = saved[String(count)];
    if (isColumns(cols) && cols.length === count) layouts[count] = cols;
  }
  const hidden = Array.isArray(r.hidden)
    ? r.hidden.filter((p): p is string => typeof p === "string" && canHide(p))
    : [];
  return { wanted: r.wanted === 2 ? 2 : 3, layouts, hidden: [...new Set(hidden)] };
}

function remembered(): PlayLayout {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return parseLayout(JSON.parse(saved));
  } catch {
    // Storage may be blocked or the text damaged: the screen uses its own plan.
  }
  return EMPTY_LAYOUT;
}

export const playLayout = signal<PlayLayout>(remembered());

/** Whether the screen is open for arranging the panels. Not remembered. */
export const customizing = signal(false);

export function setPlayLayout(next: PlayLayout) {
  playLayout.value = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not remembered: it still works for this visit.
  }
}

/** Whether the person has arranged anything: the phone then follows their order. */
export const isArranged = (l: PlayLayout) => Object.keys(l.layouts).length > 0;

/**
 * Puts back, in the columns just arranged, the panels the person has hidden where they were in the
 * arrangement saved before, so showing one again brings it to its old place.
 */
export function keepHidden(before: Columns | undefined, now: Columns, hidden: string[]): Columns {
  if (!before) return now;
  const next = now.map((col) => [...col]);
  for (const panel of hidden) {
    const c = before.findIndex((col) => col.includes(panel));
    const target = next[c];
    if (!target || next.some((col) => col.includes(panel))) continue;
    target.splice(Math.min((before[c] as string[]).indexOf(panel), target.length), 0, panel);
  }
  return next;
}

const without = (cols: Columns, panel: string): Columns =>
  cols.map((col) => col.filter((p) => p !== panel));

/** Puts `panel` in column `to` at place `at` (counted without it); the other columns lose it. */
export function moveTo(cols: Columns, panel: string, to: number, at: number): Columns {
  const next = without(cols, panel);
  const target = next[to];
  if (!target) return cols;
  target.splice(Math.max(0, Math.min(at, target.length)), 0, panel);
  return next;
}

/**
 * One step for a panel: up or down in its column (past the panels `accept` turns down: on a phone
 * only the panels of the same part count), or to the neighbouring column at the same height.
 */
export function nudge(
  cols: Columns,
  panel: string,
  dir: "up" | "down" | "left" | "right",
  accept: (other: string) => boolean = () => true,
): Columns {
  const from = cols.findIndex((col) => col.includes(panel));
  if (from < 0) return cols;
  const col = cols[from] as string[];
  const at = col.indexOf(panel);
  if (dir === "left" || dir === "right") {
    const to = from + (dir === "left" ? -1 : 1);
    return cols[to] ? moveTo(cols, panel, to, at) : cols;
  }
  const step = dir === "up" ? -1 : 1;
  for (let j = at + step; j >= 0 && j < col.length; j += step) {
    if (!accept(col[j] as string)) continue;
    // Taken out first, the panel lands where the one it passes was: before it going up, after it down.
    return moveTo(cols, panel, from, j);
  }
  return cols;
}
