import en from "../../locales/en/ui.json";

export type UiKey = keyof typeof en;

/** Interface text. English only for now; other locales will be loaded the same way as rules texts. */
export function ui(key: UiKey, params: Record<string, string | number> = {}): string {
  return en[key].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

/** Signed number for modifiers: `+3`, `-1`, `0` shown as `+0`. */
export const signed = (n: number) => (n >= 0 ? `+${n}` : String(n));
