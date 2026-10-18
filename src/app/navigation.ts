import { effect, signal } from "@preact/signals";

/** Which screen is showing. `build`, `sheet` and `print` are the tabs; `credits` is a page. */
export type View = "build" | "sheet" | "print" | "credits";
export type Tab = "build" | "sheet" | "print";

const STORAGE_KEY = "tab";

/** The tab to reopen on the next visit. Print is never reopened: it is a one-off action. */
function savedTab(): "build" | "sheet" {
  try {
    return localStorage.getItem(STORAGE_KEY) === "sheet" ? "sheet" : "build";
  } catch {
    return "build";
  }
}

export const view = signal<View>(savedTab());

/** The tab to go back to when leaving the credits page. */
let lastTab: Tab = view.value === "credits" ? "build" : (view.value as Tab);

export function showView(next: View) {
  if (next !== "credits") lastTab = next;
  view.value = next;
}

export function leaveCredits() {
  view.value = lastTab;
}

effect(() => {
  if (view.value !== "build" && view.value !== "sheet") return;
  try {
    localStorage.setItem(STORAGE_KEY, view.value);
  } catch {
    // Ignore: the tab just won't be remembered.
  }
});
