import { effect, signal } from "@preact/signals";
import { type PrintSettings, parsePrintSettings } from "./printSettings.logic";

export type { Paper, PrintSettings, SpellMode } from "./printSettings.logic";

const STORAGE_KEY = "print-settings";

function load(): PrintSettings {
  try {
    return parsePrintSettings(localStorage.getItem(STORAGE_KEY));
  } catch {
    return parsePrintSettings(null);
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
