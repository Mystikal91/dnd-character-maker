/** Languages the interface can be shown in. Each is named in its own language. */
export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "it", name: "Italiano" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const LANGUAGE_STORAGE_KEY = "dnd-maker.language";
export const DEFAULT_LANGUAGE: LanguageCode = "en";

const isLanguage = (value: unknown): value is LanguageCode =>
  LANGUAGES.some((l) => l.code === value);

/**
 * The saved choice if there is one, otherwise the first browser language we support
 * (`it-IT` counts as `it`), otherwise English.
 */
export function pickLanguage(
  saved: string | null | undefined,
  preferred: readonly string[],
): LanguageCode {
  if (isLanguage(saved)) return saved;
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLanguage(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

/** Locales to load rules texts from, in priority order: the chosen language, then English. */
export const localeChain = (code: LanguageCode): string[] =>
  code === DEFAULT_LANGUAGE ? [DEFAULT_LANGUAGE] : [code, DEFAULT_LANGUAGE];
