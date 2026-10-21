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

/** The browser's own bar takes the colour of the page, in the light or the dark look. */
export function matchThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (bg && meta) meta.setAttribute("content", bg);
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", matchThemeColor);

// Apply to the page and remember the choice. Storage is a convenience: it may be refused.
effect(() => {
  const { style, scheme } = themeAttributes(theme.value);
  const root = document.documentElement;
  root.dataset.style = style;
  if (scheme) root.dataset.theme = scheme;
  else delete root.dataset.theme;
  matchThemeColor();
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme.value));
  } catch {
    // Ignore: the choice just won't persist.
  }
});
