import { effect, signal } from "@preact/signals";
import { metricUnits, unitLocale } from "../i18n/units";
import { language } from "./language";

export type UnitSetting = "auto" | "imperial" | "metric";
export const UNIT_SETTINGS: UnitSetting[] = ["auto", "imperial", "metric"];

const STORAGE_KEY = "units";

function readInitial(): UnitSetting {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "imperial" || saved === "metric") return saved;
  } catch {
    // Storage may be refused: fall back to the language's habit.
  }
  return "auto";
}

/** Units for distances and weights. Automatic follows the language: English is imperial. */
export const unitSetting = signal<UnitSetting>(readInitial());

effect(() => {
  metricUnits.value =
    unitSetting.value === "metric" || (unitSetting.value === "auto" && language.value !== "en");
  unitLocale.value = language.value;
  try {
    localStorage.setItem(STORAGE_KEY, unitSetting.value);
  } catch {
    // Ignore: the choice just won't persist.
  }
});
