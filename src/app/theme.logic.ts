/** The look of the app: `fantasy` is parchment and ornate frames, `modern` is clean and flat. */
export type StyleName = "fantasy" | "modern";
/** `auto` follows the device's light or dark setting. */
export type Scheme = "auto" | "light" | "dark";

export interface ThemeSettings {
  style: StyleName;
  scheme: Scheme;
}

export const DEFAULT_THEME: ThemeSettings = { style: "fantasy", scheme: "auto" };

export const THEME_STORAGE_KEY = "theme";

/** Reads saved settings; anything missing or malformed falls back to the defaults. */
export function parseTheme(raw: string | null): ThemeSettings {
  try {
    const saved = JSON.parse(raw ?? "{}") as Partial<ThemeSettings>;
    return {
      style: saved.style === "modern" ? "modern" : DEFAULT_THEME.style,
      scheme:
        saved.scheme === "light" || saved.scheme === "dark" ? saved.scheme : DEFAULT_THEME.scheme,
    };
  } catch {
    return DEFAULT_THEME;
  }
}

/** The `data-` attributes the stylesheet keys on. `auto` sets no scheme: CSS follows the device. */
export function themeAttributes(theme: ThemeSettings): {
  style: StyleName;
  scheme?: "light" | "dark";
} {
  return theme.scheme === "auto"
    ? { style: theme.style }
    : { style: theme.style, scheme: theme.scheme };
}
