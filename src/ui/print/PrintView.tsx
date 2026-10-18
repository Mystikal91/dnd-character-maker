import { showView } from "../../app/navigation";
import {
  type Paper,
  type PrintSettings,
  type SpellMode,
  printSettings,
  updatePrintSettings,
} from "../../app/printSettings";
import { printsNothing } from "../../app/printSettings.logic";
import { content, sheet } from "../../app/store";
import { type UiKey, ui } from "../../i18n/ui";
import { collectSpellRows } from "../spellRows";
import { Cards } from "./CardsGroup";
import { FeatureText } from "./FeatureText";
import { FrontPage } from "./FrontPage";
import { SpellPages } from "./SpellPages";
import { StoryPage } from "./StoryPage";

const PAGE_SIZE: Record<Paper, string> = { a4: "A4", letter: "letter" };

type FlagKey = {
  [K in keyof PrintSettings]: PrintSettings[K] extends boolean ? K : never;
}[keyof PrintSettings];

interface Toggle {
  key: FlagKey;
  label: UiKey;
  /** The option makes no sense for this character. */
  disabled?: boolean;
}

/** Print preview with its options. The page content is what the browser prints. */
export function PrintView() {
  const settings = printSettings.value;
  const c = content.value;
  const s = sheet.value;
  const isCaster = Boolean(s?.spellcasting);
  const hasSpells = Boolean(c && s && collectSpellRows(c, s).length > 0);
  const nothing = printsNothing(settings, isCaster);

  const toggles: Toggle[] = [
    { key: "includeSheet", label: "print.sheet" },
    { key: "includeStory", label: "print.story" },
    { key: "includeFeatureText", label: "print.featureText" },
    { key: "includeAvailable", label: "print.available", disabled: !isCaster },
    { key: "spellCards", label: "print.spellCards", disabled: !hasSpells },
    { key: "featureCards", label: "print.featureCards" },
    { key: "lowInk", label: "print.lowInk" },
  ];

  return (
    <div class={`print-root paper-${settings.paper}${settings.lowInk ? " low-ink" : ""}`}>
      {/* Paper size and margins for the real print job; the preview mimics them. */}
      <style>{`@page { size: ${PAGE_SIZE[settings.paper]}; margin: 12mm; }`}</style>

      <div class="card print-toolbar no-print">
        <div class="print-actions">
          <button type="button" class="secondary" onClick={() => showView("edit")}>
            {ui("print.back")}
          </button>
          <button type="button" class="primary" onClick={() => window.print()} disabled={nothing}>
            {ui("print.print")}
          </button>
        </div>
        <p class="muted">{ui("print.hint")}</p>

        <div class="print-options">
          <div>
            <label class="field">
              <span>{ui("print.paper")}</span>
              <select
                value={settings.paper}
                onChange={(e) => updatePrintSettings({ paper: e.currentTarget.value as Paper })}
              >
                <option value="a4">{ui("print.paperA4")}</option>
                <option value="letter">{ui("print.paperLetter")}</option>
              </select>
            </label>
            <label class="field">
              <span>{ui("print.spells")}</span>
              <select
                value={settings.spellMode}
                onChange={(e) =>
                  updatePrintSettings({ spellMode: e.currentTarget.value as SpellMode })
                }
              >
                <option value="details">{ui("print.spellsDetails")}</option>
                <option value="compact">{ui("print.spellsCompact")}</option>
                <option value="none">{ui("print.spellsNone")}</option>
              </select>
            </label>
          </div>

          <div class="checks">
            {toggles.map((t) => (
              <label key={t.key}>
                <input
                  type="checkbox"
                  checked={settings[t.key] && !t.disabled}
                  disabled={t.disabled}
                  onChange={(e) => updatePrintSettings({ [t.key]: e.currentTarget.checked })}
                />
                {ui(t.label)}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div class="paper-scroll">
        <div class="paper">
          {nothing && <p class="no-print">{ui("print.nothing")}</p>}
          {settings.includeSheet && <FrontPage />}
          {settings.includeStory && <StoryPage />}
          {settings.includeFeatureText && <FeatureText />}
          <SpellPages />
          <Cards />
        </div>
      </div>
    </div>
  );
}
