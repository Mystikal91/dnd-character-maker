import type { ComponentChildren } from "preact";
import { ui } from "../../i18n/ui";

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

/** Text with blank lines between paragraphs, as stored in the rules texts. */
export function Paragraphs({ text }: { text: string | undefined }) {
  return (
    <>
      {text?.split("\n\n").map((p) => (
        <p key={p}>{p}</p>
      ))}
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
export function RulesText({ name, text }: { name: string; text: string | undefined }) {
  return (
    <details>
      <summary>{name}</summary>
      <Paragraphs text={text} />
    </details>
  );
}
