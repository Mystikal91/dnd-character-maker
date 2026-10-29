import { describe, expect, it } from "vitest";
import { deriveSheet } from "../engine/derive";
import { srd51Index as index } from "../test/srd51";
import { EXAMPLE_ID, buildExample } from "./example";

const story = {
  personalityTraits: "p",
  ideals: "i",
  bonds: "b",
  flaws: "f",
  appearance: "a",
};

describe("the example character", () => {
  const c = buildExample(index, story);
  const sheet = deriveSheet(c, index);

  it("is Aria, a wizard of level 5 with an evocation school", () => {
    expect(c.name).toBe("Aria Nightbloom");
    expect(c.classes).toEqual([
      { classId: "srd51:class/wizard", level: 5, subclassId: "srd51:subclass/evocation" },
    ]);
  });

  it("always has the same id, so that it is found again and not made anew", () => {
    expect(c.id).toBe(EXAMPLE_ID);
    expect(buildExample(index, story).id).toBe(EXAMPLE_ID);
  });

  it("has nothing left to choose and no warnings", () => {
    expect(sheet.choices.every((choice) => choice.remaining <= 0)).toBe(true);
    expect(sheet.warnings).toEqual([]);
  });

  it("knows spells up to level 3 and has them filled in", () => {
    const lists = sheet.spellcasters[0]?.lists;
    expect(lists?.maxSpellLevel).toBe(3);
    expect(lists?.cantrips?.chosen.length).toBe(lists?.cantrips?.allowed);
    expect(lists?.known?.chosen.length).toBe(lists?.known?.allowed);
    expect(lists?.prepared?.chosen.length).toBe(lists?.prepared?.allowed);
  });
});
