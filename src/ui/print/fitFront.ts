/**
 * The front page is one page tall. A character with a long spell list or many class features does
 * not fit at the usual size, so the page gets denser, level by level, until every column fits (the
 * levels are `data-density` in print.css). The notes already give way first; this is for the rest.
 */
export const DENSITY_LEVELS = 3;

const overflows = (page: HTMLElement): boolean =>
  [...page.querySelectorAll<HTMLElement>(".p-col")].some(
    (c) => c.scrollHeight > c.clientHeight + 1,
  );

/** Sets the lowest density at which no column spills over; the last one when none is enough. */
export function fitFront(page: HTMLElement): number {
  for (let level = 0; level <= DENSITY_LEVELS; level++) {
    page.dataset.density = String(level);
    if (!overflows(page)) return level;
  }
  return DENSITY_LEVELS;
}
