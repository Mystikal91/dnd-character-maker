import type { RefObject } from "preact";
import { useEffect } from "preact/hooks";

/** A swipe counts when it is this long and clearly more sideways than up or down. */
const MIN_DISTANCE = 60;
const MIN_RATIO = 2;

/** Things a finger drags or types in: a swipe that starts on them is not meant to change part. */
const KEEPS_TOUCH = "input, select, textarea, [contenteditable], dialog, [role=slider]";

/** Whether the element, or one above it up to `root`, scrolls sideways. */
function scrollsSideways(from: Element | null, root: Element): boolean {
  for (let el = from; el && el !== root; el = el.parentElement) {
    const { overflowX } = getComputedStyle(el);
    if ((overflowX === "auto" || overflowX === "scroll") && el.scrollWidth > el.clientWidth)
      return true;
  }
  return false;
}

/**
 * Swiping sideways on the element moves to the next part (to the left) or the previous one (to
 * the right): `step` gets +1 or -1 and says whether it moved. Nothing happens while `enabled` says
 * the parts are not tabs (a wide screen shows them all), nor on fields and things that scroll
 * sideways. The element gets `data-dir` for a moment so the parts can slide in the right way.
 */
export function useSwipe(
  ref: RefObject<HTMLElement>,
  enabled: () => boolean,
  step: (delta: 1 | -1) => boolean,
) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let start: { x: number; y: number; ok: boolean } | undefined;

    const onStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const target = e.target instanceof Element ? e.target : null;
      start =
        e.touches.length === 1 && touch
          ? {
              x: touch.clientX,
              y: touch.clientY,
              ok: enabled() && !target?.closest(KEEPS_TOUCH) && !scrollsSideways(target, root),
            }
          : undefined;
    };

    const onEnd = (e: TouchEvent) => {
      const from = start;
      start = undefined;
      const touch = e.changedTouches[0];
      if (!from?.ok || !touch) return;
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < MIN_RATIO * Math.abs(dy)) return;
      const delta = dx < 0 ? 1 : -1;
      root.dataset.dir = delta === 1 ? "next" : "prev";
      if (!step(delta)) {
        delete root.dataset.dir;
        return;
      }
      // Back to the top of the part, so a short one is not seen from its middle.
      const bar = root.querySelector(".play-head, .sheet-sticky");
      const content = root.querySelector(".play-grid, .sheet-grid");
      if (bar && content) {
        const top = content.getBoundingClientRect().top + window.scrollY - bar.clientHeight;
        const barTop = Number.parseFloat(getComputedStyle(bar).top) || 0;
        if (window.scrollY > top - barTop) window.scrollTo({ top: Math.max(0, top - barTop) });
      }
      window.setTimeout(() => delete root.dataset.dir, 400);
    };

    const onCancel = () => {
      start = undefined;
    };

    root.addEventListener("touchstart", onStart, { passive: true });
    root.addEventListener("touchend", onEnd, { passive: true });
    root.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", onCancel);
    };
  });
}

/** The part `delta` places away in `groups`, or nothing at either end. */
export function neighbour<T>(groups: readonly T[], open: T, delta: 1 | -1): T | undefined {
  return groups[groups.indexOf(open) + delta];
}
