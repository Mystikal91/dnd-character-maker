import { useEffect, useRef } from "preact/hooks";

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Makes a number roll in when its text changes: the new value slides up into place. The first
 * time it is shown nothing moves, and nothing moves at all for someone who asked for less motion.
 * Put the returned ref on the element that holds the number.
 */
export function useRoll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const last = useRef<string | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const text = element.textContent ?? "";
    if (last.current !== null && last.current !== text && !reducedMotion()) {
      element.animate(
        [
          { transform: "translateY(55%) scale(0.85)", opacity: 0 },
          { transform: "translateY(0) scale(1.08)", opacity: 1, offset: 0.7 },
          { transform: "translateY(0) scale(1)", opacity: 1 },
        ],
        { duration: 380, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
    }
    last.current = text;
  });
  return ref;
}
