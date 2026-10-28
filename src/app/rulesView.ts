import { signal } from "@preact/signals";
import { SEARCH_KINDS, type SearchKind } from "./search";

const KEY = "rulesKind";

function remembered(): SearchKind | undefined {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && (SEARCH_KINDS as readonly string[]).includes(saved)) return saved as SearchKind;
  } catch {
    // Storage may be blocked: the page opens on all kinds.
  }
  return undefined;
}

/** What is typed in the search of the rules page. */
export const rulesQuery = signal("");
/** The kind the page is limited to; the last one is remembered. */
export const rulesKind = signal<SearchKind | undefined>(remembered());
/** Raised to put the cursor in the search field (the button in the header, the slash key). */
export const rulesFocus = signal(0);

export function showRulesKind(kind: SearchKind | undefined) {
  rulesKind.value = kind;
  try {
    if (kind) localStorage.setItem(KEY, kind);
    else localStorage.removeItem(KEY);
  } catch {
    // Not remembered: it still works for this visit.
  }
}
