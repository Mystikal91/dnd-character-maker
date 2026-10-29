import { LANGUAGES, type LanguageCode, language } from "../app/language";
import { theme, updateTheme } from "../app/theme";
import { PALETTES, type Scheme } from "../app/theme.logic";
import { UNIT_SETTINGS, type UnitSetting, unitSetting } from "../app/units";
import { type UiKey, ui } from "../i18n/ui";

const SCHEMES: Scheme[] = ["auto", "light", "dark"];

/** Choose the colour set of the app (shown as its dark and its light look) and the mode. */
function PalettePicker() {
  const current = theme.value.palette;
  return (
    <div class="field">
      <span id="palette-label">{ui("theme.palette")}</span>
      <div class="palette-picker" role="radiogroup" aria-labelledby="palette-label">
        {PALETTES.map((name) => (
          <label key={name} class="palette-swatch" data-palette={name}>
            <input
              type="radio"
              name="palette"
              checked={name === current}
              onChange={() => updateTheme({ palette: name })}
            />
            <span class="palette-chip" aria-hidden="true">
              <span class="dark" />
              <span class="light" />
            </span>
            <span class="palette-name">{ui(`theme.palette.${name}` as UiKey)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/** Choose the look of the app: language, colour set, units and mode (auto, light, dark). */
export function ThemeControls() {
  const current = theme.value;
  return (
    <div class="theme-controls">
      <label class="field">
        <span>{ui("language.label")}</span>
        <select
          value={language.value}
          onChange={(e) => {
            language.value = e.currentTarget.value as LanguageCode;
          }}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code} lang={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <PalettePicker />
      <label class="field">
        <span>{ui("units.label")}</span>
        <select
          value={unitSetting.value}
          onChange={(e) => {
            unitSetting.value = e.currentTarget.value as UnitSetting;
          }}
        >
          {UNIT_SETTINGS.map((setting) => (
            <option key={setting} value={setting}>
              {ui(`units.${setting}` as UiKey)}
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
