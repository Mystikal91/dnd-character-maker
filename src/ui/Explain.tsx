import { signal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { character, content, sheet } from "../app/store";
import { type ExplainLine, type ExplainTarget, explain } from "../engine/explain";
import { type UiKey, signed, ui } from "../i18n/ui";

/** The number whose parts are open in the dialog, if any. */
const explaining = signal<ExplainTarget | undefined>(undefined);

/** What the number is called, for the title and the label of the button. */
function nameOf(target: ExplainTarget): string {
  const c = content.value;
  const ruleset = character.value.ruleset;
  if (!c) return "";
  switch (target.kind) {
    case "ac":
      return ui("sheet.armorClass");
    case "initiative":
      return ui("sheet.initiative");
    case "save":
      return `${c.name(`${ruleset}:ability/${target.ability}`)} · ${ui("sheet.savingThrow")}`;
    case "skill":
      return c.name(target.id);
    case "attack":
      return `${c.name(target.itemId)} · ${ui("sheet.attackBonus")}`;
  }
}

/** A number of the sheet that opens its parts when tapped. */
export function ExplainButton({
  target,
  class: className = "",
  children,
}: {
  target: ExplainTarget;
  class?: string;
  children: ComponentChildren;
}) {
  return (
    <button
      type="button"
      class={`explain-trigger ${className}`.trim()}
      aria-label={ui("explain.open", { what: nameOf(target) })}
      aria-haspopup="dialog"
      onClick={() => {
        explaining.value = target;
      }}
    >
      {children}
    </button>
  );
}

function lineLabel(line: ExplainLine): string {
  const c = content.value;
  if (!c) return "";
  const ruleset = character.value.ruleset;
  if (line.part === "ability" && line.ref) return c.name(`${ruleset}:ability/${line.ref}`);
  if ((line.part === "armor" || line.part === "shield" || line.part === "feature") && line.ref)
    return c.name(line.ref);
  return ui(`explain.part.${line.part}` as UiKey);
}

/** The dialog that takes a number apart. Mount it once, near the root. */
export function ExplainDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const target = explaining.value;
  const c = content.value;
  const s = sheet.value;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (target && !el.open) el.showModal();
    if (!target && el.open) el.close();
  }, [target]);

  const explained = target && c && s ? explain(target, s, character.value, c.index) : undefined;

  // A forced number is shown as the calculation adds up, so the lines and the total agree.
  const shown = explained
    ? explained.forced
      ? explained.lines.reduce((sum, l) => sum + l.value, 0)
      : explained.total
    : 0;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking the backdrop is a mouse shortcut; Escape and the Close button are the keyboard ways out
    <dialog
      ref={dialog}
      class="spell-dialog explain-dialog"
      onClose={() => {
        explaining.value = undefined;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) explaining.value = undefined;
      }}
    >
      {target && explained && (
        <div class="spell-dialog-body">
          <button
            type="button"
            class="secondary close"
            onClick={() => {
              explaining.value = undefined;
            }}
          >
            {ui("spells.closeInfo")}
          </button>
          <h3>{ui("explain.title", { what: nameOf(target) })}</h3>
          {explained.forced && <p class="note">{ui("explain.forced")}</p>}
          <ul class="explain-lines">
            {explained.lines.map((line, i) => (
              <li key={`${line.part}-${line.ref ?? ""}-${i}`}>
                <span>{lineLabel(line)}</span>
                <b>{line.part === "base" ? line.value : signed(line.value)}</b>
              </li>
            ))}
            <li class="explain-total">
              <span>{ui("explain.total")}</span>
              <b>{shown}</b>
            </li>
          </ul>
        </div>
      )}
    </dialog>
  );
}
