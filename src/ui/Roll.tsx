import type { ComponentChildren } from "preact";
import { useRoll } from "./useRoll";

/** A value that rolls in when it changes (see `useRoll`), for places that cannot call the hook. */
export function Roll({
  class: className,
  as: Tag = "span",
  children,
}: {
  class?: string;
  as?: "span" | "div" | "b";
  children: ComponentChildren;
}) {
  const ref = useRoll<HTMLElement>();
  // biome-ignore lint/suspicious/noExplicitAny: the tag is one of a few plain elements
  const Element = Tag as any;
  return (
    <Element class={className} ref={ref}>
      {children}
    </Element>
  );
}
