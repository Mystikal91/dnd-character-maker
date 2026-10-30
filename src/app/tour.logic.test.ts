import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOUR_STEPS, cardGoesBelow, spotAround, stepAfter, stepBefore } from "./tour.logic";

const LANGUAGES = ["en", "it", "fr", "de", "es"];
const texts = (lang: string): Record<string, string> =>
  JSON.parse(readFileSync(`locales/${lang}/ui.json`, "utf8"));

describe("the guided tour", () => {
  it("has stops with their own ids, in an order that can be walked both ways", () => {
    const ids = TOUR_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(stepBefore(0)).toBeUndefined();
    expect(stepAfter(TOUR_STEPS.length - 1)).toBeUndefined();
    expect(stepAfter(0)).toBe(1);
    expect(stepBefore(1)).toBe(0);
  });

  it("has a title and a text for every stop in every language", () => {
    for (const lang of LANGUAGES) {
      const t = texts(lang);
      for (const step of TOUR_STEPS) {
        expect(t[`tour.${step.id}.title`], `${lang} ${step.id} title`).toBeTruthy();
        expect(t[`tour.${step.id}.body`], `${lang} ${step.id} body`).toBeTruthy();
      }
      for (const key of ["label", "step", "next", "back", "done", "skip", "guides", "start"]) {
        expect(t[`tour.${key}`], `${lang} ${key}`).toBeTruthy();
      }
      expect(t["tour.step"]).toContain("{n}");
      expect(t["tour.step"]).toContain("{total}");
    }
  });
});

describe("the lit part", () => {
  const screen = { width: 400, height: 800 };

  it("leaves room around what it lights and stays on the screen", () => {
    expect(spotAround({ top: 100, left: 50, width: 200, height: 40 }, screen)).toEqual({
      top: 94,
      left: 44,
      width: 212,
      height: 52,
    });
    expect(spotAround({ top: -30, left: -10, width: 500, height: 900 }, screen)).toEqual({
      top: 0,
      left: 0,
      width: 400,
      height: 800,
    });
  });

  it("puts the card on the other half of the screen", () => {
    expect(cardGoesBelow({ top: 20, left: 0, width: 100, height: 40 }, 800)).toBe(true);
    expect(cardGoesBelow({ top: 600, left: 0, width: 100, height: 40 }, 800)).toBe(false);
  });
});
