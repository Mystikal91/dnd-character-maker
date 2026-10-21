import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

interface PopoverProps {
  /** The button that opens it. */
  label: ComponentChildren;
  /** Text for screen readers when the label is only an icon. */
  title: string;
  /** Which edge of the button the panel lines up with. */
  align?: "start" | "end";
  class?: string;
  children: ComponentChildren;
}

/**
 * A small menu that opens under its button and closes on a tap outside, on Escape, and when
 * something inside it is chosen (a button or a link). Built on `details`, so it works with a
 * keyboard and a screen reader without more code.
 */
export function Popover({ label, title, align = "end", class: extra, children }: PopoverProps) {
  const box = useRef<HTMLDetailsElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = () => {
      if (box.current) box.current.open = false;
    };
    const outside = (e: Event) => {
      if (box.current?.open && !box.current.contains(e.target as Node)) close();
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !box.current?.open) return;
      close();
      box.current.querySelector("summary")?.focus();
    };
    // A button or link inside (but not a field) closes the menu once it has done its job.
    const chosen = (e: Event) => {
      if ((e.target as HTMLElement).closest("button, a")) close();
    };
    const inside = panel.current;
    inside?.addEventListener("click", chosen);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", onEscape);
    return () => {
      inside?.removeEventListener("click", chosen);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <details ref={box} class={`popover popover-${align}${extra ? ` ${extra}` : ""}`}>
      <summary class="popover-button" aria-label={title} title={title}>
        {label}
      </summary>
      <div class="popover-panel" ref={panel}>
        {children}
      </div>
    </details>
  );
}
