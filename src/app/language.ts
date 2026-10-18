import { effect, signal } from "@preact/signals";
import { LANGUAGE_STORAGE_KEY, type LanguageCode, pickLanguage } from "./language.logic";

export { LANGUAGES, type LanguageCode, localeChain } from "./language.logic";

function readInitial(): LanguageCode {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    // Storage may be refused; fall back to the browser language.
  }
  return pickLanguage(saved, navigator.languages);
}

export const language = signal<LanguageCode>(readInitial());

// Apply to the page and remember the choice. Storage is a convenience: it may be refused.
effect(() => {
  document.documentElement.lang = language.value;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language.value);
  } catch {
    // Ignore: the choice just won't persist.
  }
});
