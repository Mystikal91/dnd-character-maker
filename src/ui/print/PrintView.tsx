import { showView } from "../../app/navigation";
import {
  type Paper,
  type SpellMode,
  printSettings,
  updatePrintSettings,
} from "../../app/printSettings";
import { sheet } from "../../app/store";
import { ui } from "../../i18n/ui";
import { CharacterPages } from "./CharacterPages";
import { SpellPages } from "./SpellPages";

const PAGE_SIZE: Record<Paper, string> = { a4: "A4", letter: "letter" };

/** Print preview with its options. The page content is what the browser prints. */
export function PrintView() {
  const settings = printSettings.value;
  const nothing =
    !settings.includeSheet && settings.spellMode === "none" && !settings.includeAvailable;

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

          <div class="checks">
            <label>
              <input
                type="checkbox"
                checked={settings.includeSheet}
                onChange={(e) => updatePrintSettings({ includeSheet: e.currentTarget.checked })}
              />
              {ui("print.sheet")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.includeAvailable}
                disabled={!sheet.value?.spellcasting}
                onChange={(e) => updatePrintSettings({ includeAvailable: e.currentTarget.checked })}
              />
              {ui("print.available")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.lowInk}
                onChange={(e) => updatePrintSettings({ lowInk: e.currentTarget.checked })}
              />
              {ui("print.lowInk")}
            </label>
          </div>
        </div>
      </div>

      <div class="paper-scroll">
        <div class="paper">
          {nothing && <p class="no-print">{ui("print.nothing")}</p>}
          {settings.includeSheet && <CharacterPages />}
          <SpellPages />
        </div>
      </div>
    </div>
  );
}
