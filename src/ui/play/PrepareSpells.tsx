import { signal } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";
import { content, sheet } from "../../app/store";
import type { DerivedSheet, SpellcastingResult } from "../../engine/derive";
import { ui } from "../../i18n/ui";
import { SpellList } from "../SpellPicker";

/** Why the window is open: asked for by the button of the spells, or the step after a long rest. */
export const prepareAsked = signal<"button" | "rest" | undefined>(undefined);

/** The classes that prepare their spells (clerics, druids, paladins, wizards...), in the order of the sheet. */
export function preparingCasters(s: DerivedSheet | undefined): SpellcastingResult[] {
  return (s?.spellcasters ?? []).filter((caster) => caster.lists.prepared !== undefined);
}

/**
 * The window to change the prepared spells: for each class that prepares them, the list it may
 * pick from with the number it may hold, as in the build screen. A change is saved at once.
 */
export function PrepareSpellsDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [filter, setFilter] = useState("");
  const asked = prepareAsked.value;
  const c = content.value;
  const casters = preparingCasters(sheet.value);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (asked && !el.open) el.showModal();
    if (!asked && el.open) el.close();
  }, [asked]);

  const close = () => {
    prepareAsked.value = undefined;
    setFilter("");
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking the backdrop is a mouse shortcut; Escape and the button are the keyboard ways out
    <dialog
      ref={dialog}
      class="spell-dialog prepare-dialog"
      aria-labelledby="prepare-title"
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {asked && c && (
        <div class="spell-dialog-body">
          <h3 id="prepare-title">{ui("spells.prepared")}</h3>
          <p class="muted">{ui(asked === "rest" ? "play.prepareAfterRest" : "play.prepareHint")}</p>
          <label class="field">
            <span>{ui("spells.filter")}</span>
            <input type="search" value={filter} onInput={(e) => setFilter(e.currentTarget.value)} />
          </label>
          {casters.map((caster) =>
            caster.lists.prepared ? (
              <SpellList
                key={caster.classId}
                classId={caster.classId}
                list="prepared"
                title={casters.length > 1 ? c.name(caster.classId) : ui("spells.prepared")}
                pick={caster.lists.prepared}
                filter={filter}
                c={c}
              />
            ) : null,
          )}
          <div class="card-actions prepare-actions">
            <button type="button" class="card-btn card-primary" onClick={close}>
              {ui("play.prepareDone")}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

/** The button of the spells that opens the window; nothing for a class that does not prepare. */
export function PrepareSpellsButton() {
  if (preparingCasters(sheet.value).length === 0) return null;
  return (
    <button
      type="button"
      class="card-btn prepare-btn"
      title={ui("play.prepareButtonFull")}
      aria-label={ui("play.prepareButtonFull")}
      onClick={() => {
        prepareAsked.value = "button";
      }}
    >
      {ui("play.prepareButton")}
    </button>
  );
}
