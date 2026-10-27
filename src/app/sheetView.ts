import { signal } from "@preact/signals";

/** The parts the character sheet is split into on a phone. */
export const SHEET_GROUPS = ["profile", "combat", "magic", "bag", "features"] as const;
export type SheetGroup = (typeof SHEET_GROUPS)[number];

const KEY = "sheetGroup";

function remembered(): SheetGroup {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && (SHEET_GROUPS as readonly string[]).includes(saved)) return saved as SheetGroup;
  } catch {
    // Storage may be blocked: the sheet opens on its first part.
  }
  return "profile";
}

/** The part shown on a phone; the person comes back to the one they left. */
export const sheetGroup = signal<SheetGroup>(remembered());

export function showSheetGroup(group: SheetGroup) {
  sheetGroup.value = group;
  try {
    localStorage.setItem(KEY, group);
  } catch {
    // Not remembered: it still works for this visit.
  }
}
