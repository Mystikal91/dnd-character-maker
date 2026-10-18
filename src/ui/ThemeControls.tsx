import { theme, updateTheme } from "../app/theme";
import type { Scheme, StyleName } from "../app/theme.logic";
import { type UiKey, ui } from "../i18n/ui";

const STYLES: StyleName[] = ["fantasy", "modern"];
const SCHEMES: Scheme[] = ["auto", "light", "dark"];

/** Choose the look of the app: a style (fantasy or modern) and a mode (auto, light, dark). */
export function ThemeControls() {
  const current = theme.value;
  return (
    <div class="theme-controls">
      <label class="field">
        <span>{ui("theme.style")}</span>
        <select
          value={current.style}
          onChange={(e) => updateTheme({ style: e.currentTarget.value as StyleName })}
        >
          {STYLES.map((style) => (
            <option key={style} value={style}>
              {ui(`theme.${style}` as UiKey)}
            </option>
          ))}
        </select>
      </label>
      <label class="field">
        <span>{ui("theme.mode")}</span>
        <select
          value={current.scheme}
          onChange={(e) => updateTheme({ scheme: e.currentTarget.value as Scheme })}
        >
          {SCHEMES.map((scheme) => (
            <option key={scheme} value={scheme}>
              {ui(`theme.${scheme}` as UiKey)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
