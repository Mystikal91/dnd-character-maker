/**
 * Dragging a panel of the Play screen by its bar to a place of the columns, with the pointer (mouse,
 * pen or finger). It works on the drawn page: the columns and the panels in them are read from the
 * DOM (`.play-col` and the `.pg[data-panel]` in each), so nothing here knows what a panel is.
 */

export interface Slot {
  top: number;
  bottom: number;
  /** False for a panel that is not on screen (on a phone, the ones of another part). */
  shown: boolean;
}

/**
 * Where a dragged panel would go in a column: the place among the other panels, counted without it,
 * which is what `moveTo` takes. It goes before the first panel on screen whose middle is below the
 * pointer, or after the last one on screen.
 */
export function dropIndex(others: Slot[], y: number): number {
  let lastShown = -1;
  for (let i = 0; i < others.length; i++) {
    const s = others[i] as Slot;
    if (!s.shown) continue;
    if ((s.top + s.bottom) / 2 > y) return i;
    lastShown = i;
  }
  return lastShown >= 0 ? lastShown + 1 : others.length;
}

/** The column whose width holds `x`, or the nearest one. */
export function nearestColumn(spans: { left: number; right: number }[], x: number): number {
  let best = -1;
  let least = Number.POSITIVE_INFINITY;
  spans.forEach((s, i) => {
    const gap = x < s.left ? s.left - x : x > s.right ? x - s.right : 0;
    if (gap < least) {
      least = gap;
      best = i;
    }
  });
  return best;
}

interface Target {
  col: number;
  at: number;
  line: { left: number; top: number; width: number };
}

/** The column and place under the pointer, and where to draw the line that shows it. */
export function targetAt(
  grid: HTMLElement,
  panel: string,
  x: number,
  y: number,
): Target | undefined {
  const columns = [...grid.children].filter((el) => el.classList.contains("play-col"));
  if (columns.length === 0) return undefined;
  // On a phone the columns have no box of their own (`display: contents`): the grid is the column.
  const box = (col: Element) =>
    getComputedStyle(col).display === "contents" ? grid : (col as HTMLElement);
  const spans = columns.map((col) => box(col).getBoundingClientRect());
  const col = nearestColumn(spans, x);
  const colEl = columns[col] as Element;
  const rect = spans[col] as DOMRect;
  const others = [...colEl.children].filter(
    (el) => el instanceof HTMLElement && el.dataset.panel !== panel,
  ) as HTMLElement[];
  const slots = others.map((el): Slot => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, shown: getComputedStyle(el).display !== "none" };
  });
  const at = dropIndex(slots, y);
  // The line goes just above the panel that will be below the dragged one, else under the last.
  const below = slots.findIndex((s, i) => i >= at && s.shown);
  let top = rect.top;
  if (below >= 0) top = (slots[below] as Slot).top - 8;
  else {
    const last = slots.map((s) => s.shown).lastIndexOf(true);
    if (last >= 0) top = (slots[last] as Slot).bottom + 8;
  }
  return { col, at, line: { left: rect.left, top, width: rect.width } };
}

/** The distance from the edge of the window at which a drag starts to scroll the page. */
const EDGE = 70;

/**
 * Starts a drag that began with a press on a bar. `onDrop` is called with the column and the place
 * when the pointer is let go over the columns after moving; Escape or a cancelled pointer drops
 * nothing. The page scrolls while the pointer is near its top or bottom edge.
 */
export function beginDrag(
  event: PointerEvent,
  options: {
    grid: HTMLElement;
    panel: string;
    label: string;
    onDrop: (col: number, at: number) => void;
  },
) {
  const { grid, panel, label, onDrop } = options;
  const source = grid.querySelector<HTMLElement>(`[data-panel="${panel}"]`);
  const ghost = document.createElement("div");
  ghost.className = "drag-ghost";
  ghost.textContent = label;
  const line = document.createElement("div");
  line.className = "drop-line";
  document.body.append(ghost, line);
  source?.classList.add("dragging");

  let x = event.clientX;
  let y = event.clientY;
  let moved = false;
  let frame = 0;
  let target: Target | undefined;

  const place = () => {
    ghost.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
    target = targetAt(grid, panel, x, y);
    if (target) {
      line.style.display = "block";
      line.style.left = `${target.line.left}px`;
      line.style.top = `${target.line.top}px`;
      line.style.width = `${target.line.width}px`;
    } else line.style.display = "none";
  };
  const scroll = () => {
    const edge = y < EDGE ? -1 : y > innerHeight - EDGE ? 1 : 0;
    if (edge !== 0) {
      window.scrollBy(0, edge * 14);
      place();
    }
    frame = requestAnimationFrame(scroll);
  };
  const move = (e: PointerEvent) => {
    x = e.clientX;
    y = e.clientY;
    if (Math.abs(x - event.clientX) + Math.abs(y - event.clientY) > 4) moved = true;
    place();
  };
  const end = (drop: boolean) => {
    cancelAnimationFrame(frame);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key);
    ghost.remove();
    line.remove();
    source?.classList.remove("dragging");
    if (drop && moved && target) onDrop(target.col, target.at);
  };
  const up = () => end(true);
  const cancel = () => end(false);
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") end(false);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", key);
  place();
  frame = requestAnimationFrame(scroll);
}
