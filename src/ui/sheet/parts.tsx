import type { ComponentChildren } from "preact";
import { ui } from "../../i18n/ui";
import { machineMode, toggleOriginal } from "../../translate/auto";
import { EditPencil } from "../QuickEdit";

/** A framed panel with a titled heading. */
export function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ComponentChildren;
  className?: string;
}) {
  return (
    <section class={`card panel ${className}`.trim()}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/** Says that a text was translated by machine, and swaps it with the English original. */
export function MachineNote({ text }: { text: string | undefined }) {
  const mode = text ? machineMode(text) : undefined;
  if (!mode) return null;
  return (
    <p class="machine-note">
      <span>{ui("translate.machine")}</span>{" "}
      <button type="button" class="link" onClick={() => toggleOriginal(mode.key)}>
        {ui(mode.mode === "translated" ? "translate.showOriginal" : "translate.showTranslation")}
      </button>
    </p>
  );
}

/** Text with blank lines between paragraphs, as stored in the rules texts. */
export function Paragraphs({ text }: { text: string | undefined }) {
  return (
    <>
      {text?.split("\n\n").map((p) => (
        <p key={p}>{p}</p>
      ))}
      <MachineNote text={text} />
    </>
  );
}

/** A proficiency marker: filled when proficient, with a text alternative for screen readers. */
export function Pip({ on }: { on: boolean }) {
  return (
    <span class={`pip${on ? " on" : ""}`}>
      {on && <span class="sr-only">{ui("sheet.proficient")}</span>}
    </span>
  );
}

/** One row of empty markers, e.g. spell slots to tick off. */
export function Pips({ count }: { count: number }) {
  return (
    <span class="pips" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span class="pip" key={`pip-${i + 1}`} />
      ))}
    </span>
  );
}

/** A collapsible rules text: the name is the summary, the text is revealed on demand. */
export function RulesText({
  name,
  text,
  id,
}: { name: string; text: string | undefined; id?: string | undefined }) {
  return (
    <details>
      <summary>{name}</summary>
      {id && <EditPencil id={id} />}
      <Paragraphs text={text} />
    </details>
  );
}
