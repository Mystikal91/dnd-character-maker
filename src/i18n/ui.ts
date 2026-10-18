import en from "../../locales/en/ui.json";
import it from "../../locales/it/ui.json";
import { language } from "../app/language";

export type UiKey = keyof typeof en;

/** Interface texts per language. Missing keys fall back to English, so a partial translation works. */
const TEXTS: Record<string, Partial<Record<UiKey, string>>> = { en, it };

/** Interface text in the chosen language. Reading it in a component re-renders on language change. */
export function ui(key: UiKey, params: Record<string, string | number> = {}): string {
  const text = TEXTS[language.value]?.[key] || en[key];
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

/** Signed number for modifiers: `+3`, `-1`, `0` shown as `+0`. */
export const signed = (n: number) => (n >= 0 ? `+${n}` : String(n));
