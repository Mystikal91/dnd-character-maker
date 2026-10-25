import { character, content, updateCharacter } from "../../app/store";
import { ui } from "../../i18n/ui";
import { Paragraphs } from "../sheet/parts";
import { entriesOfKind } from "./fields";

/** The rules of the packs that can be switched on for this character, such as Tasha's customised origin. */
export function OptionalRules() {
  const all = entriesOfKind("option");
  if (all.length === 0) return null;
  const c = content.value;
  const on = character.value.options ?? [];
  return (
    <fieldset class="optional-rules">
      <legend>{ui("build.options.title")}</legend>
      <p class="muted">{ui("build.options.hint")}</p>
      {all.map((option) => (
        <div key={option.id}>
          <label class="check">
            <input
              type="checkbox"
              checked={on.includes(option.id)}
              onChange={(e) => {
                const checked = e.currentTarget.checked;
                updateCharacter((d) => {
                  const rest = (d.options ?? []).filter((id) => id !== option.id);
                  d.options = checked ? [...rest, option.id] : rest;
                });
              }}
            />
            <span>{option.label}</span>
          </label>
          {c && (
            <details class="muted">
              <summary>{ui("build.info.more")}</summary>
              <Paragraphs text={c.text(option.id, "desc")} />
            </details>
          )}
        </div>
      ))}
    </fieldset>
  );
}
