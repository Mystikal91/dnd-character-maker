import { effect, signal } from "@preact/signals";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  type ThemeSettings,
  parseTheme,
  themeAttributes,
} from "./theme.logic";

function readSaved(): ThemeSettings {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export const theme = signal<ThemeSettings>(readSaved());

export function updateTheme(change: Partial<ThemeSettings>) {
  theme.value = { ...theme.value, ...change };
}

// Apply to the page and remember the choice. Storage is a convenience: it may be refused.
effect(() => {
  const { style, scheme } = themeAttributes(theme.value);
  const root = document.documentElement;
  root.dataset.style = style;
  if (scheme) root.dataset.theme = scheme;
  else delete root.dataset.theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme.value));
  } catch {
    // Ignore: the choice just won't persist.
  }
});
