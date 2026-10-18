import { effect, signal } from "@preact/signals";

export type Paper = "a4" | "letter";
export type SpellMode = "none" | "details" | "compact";

export interface PrintSettings {
  paper: Paper;
  /** Black and white, no tints: for printing without spending colored ink. */
  lowInk: boolean;
  includeSheet: boolean;
  spellMode: SpellMode;
  /** Also list every spell the class could pick, with the chosen ones marked. */
  includeAvailable: boolean;
}

const DEFAULTS: PrintSettings = {
  paper: "a4",
  lowInk: false,
  includeSheet: true,
  spellMode: "details",
  includeAvailable: false,
};

const STORAGE_KEY = "print-settings";

/** Reads saved settings; anything missing or malformed falls back to the defaults. */
function load(): PrintSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<PrintSettings>;
    return {
      paper: saved.paper === "letter" ? "letter" : DEFAULTS.paper,
      lowInk: typeof saved.lowInk === "boolean" ? saved.lowInk : DEFAULTS.lowInk,
      includeSheet:
        typeof saved.includeSheet === "boolean" ? saved.includeSheet : DEFAULTS.includeSheet,
      spellMode:
        saved.spellMode === "none" || saved.spellMode === "compact" || saved.spellMode === "details"
          ? saved.spellMode
          : DEFAULTS.spellMode,
      includeAvailable:
        typeof saved.includeAvailable === "boolean"
          ? saved.includeAvailable
          : DEFAULTS.includeAvailable,
    };
  } catch {
    return DEFAULTS;
  }
}

export const printSettings = signal<PrintSettings>(load());

export function updatePrintSettings(change: Partial<PrintSettings>) {
  printSettings.value = { ...printSettings.value, ...change };
}

// Remembering the choice is a convenience; private windows may refuse storage.
effect(() => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(printSettings.value));
  } catch {
    // Ignore: settings just won't persist.
  }
});
