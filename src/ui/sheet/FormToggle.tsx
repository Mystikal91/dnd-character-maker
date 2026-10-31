import { character, sheetForm } from "../../app/store";
import { ui } from "../../i18n/ui";

/**
 * In the shape of a beast, two buttons choose what the sheet shows: the beast's numbers (the
 * default) or the character's own, normal form. Play always counts the beast, and the paper
 * always the normal form.
 */
export function FormToggle() {
  if (!character.value.play.wildShape) return null;
  const form = sheetForm.value;
  return (
    <fieldset class="sheet-form">
      <legend class="sr-only">{ui("sheet.form")}</legend>
      {(["beast", "own"] as const).map((f) => (
        <button
          type="button"
          key={f}
          class={`chip${form === f ? " on" : ""}`}
          aria-pressed={form === f}
          onClick={() => {
            sheetForm.value = f;
          }}
        >
          {ui(f === "beast" ? "sheet.form.beast" : "sheet.form.normal")}
        </button>
      ))}
    </fieldset>
  );
}
