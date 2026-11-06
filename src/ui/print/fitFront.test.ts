import { describe, expect, it } from "vitest";
import { DENSITY_LEVELS, fitFront } from "./fitFront";

/** A page whose columns spill over until the density reaches `enough`. */
function fakePage(enough: number) {
  const page = { dataset: {} as Record<string, string> };
  const column = {
    get scrollHeight() {
      return Number(page.dataset.density) >= enough ? 100 : 130;
    },
    clientHeight: 100,
  };
  return Object.assign(page, { querySelectorAll: () => [column] }) as unknown as HTMLElement;
}

describe("fitting the front page on one page", () => {
  it("stays at the usual size when everything fits", () => {
    const page = fakePage(0);
    expect(fitFront(page)).toBe(0);
    expect(page.dataset.density).toBe("0");
  });

  it("gets denser, one level at a time, until the columns fit", () => {
    expect(fitFront(fakePage(1))).toBe(1);
    expect(fitFront(fakePage(2))).toBe(2);
  });

  it("stops at the densest level when nothing is enough", () => {
    const page = fakePage(99);
    expect(fitFront(page)).toBe(DENSITY_LEVELS);
    expect(page.dataset.density).toBe(String(DENSITY_LEVELS));
  });
});
