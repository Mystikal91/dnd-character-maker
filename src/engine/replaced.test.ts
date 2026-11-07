import { describe, expect, it } from "vitest";
import { build, complete } from "../test/characters";
import { srd51Index } from "../test/srd51";
import { deriveSheet } from "./derive";
import { replacesOf, supersededBy } from "./replaced";

const sheetOf = (cls: string, level: number, settings?: Record<string, { hidden?: boolean }>) => {
  const character = complete(build(cls, level, "human"));
  if (settings) character.featureSettings = settings;
  return deriveSheet(character, srd51Index);
};
const feature = (slug: string) => `srd51:feature/${slug}`;

describe("features that replace the earlier steps of themselves", () => {
  const replacing = [...srd51Index.values()].filter((e) => replacesOf(e).length > 0);

  it("are written in the SRD data, each one replacing a feature of the same class and an earlier level", () => {
    expect(replacing.length).toBe(26);
    for (const entry of replacing)
      for (const id of replacesOf(entry)) {
        const old = srd51Index.get(id);
        expect(old, `${entry.id} replaces ${id}`).toBeDefined();
        expect(old?.data.class).toBe(entry.data.class);
        expect(old?.data.subclass).toBe(entry.data.subclass);
        expect(old?.data.level as number).toBeLessThan(entry.data.level as number);
      }
  });

  it("leave out the features that add to the earlier ones", () => {
    const names = replacing.map((e) => e.id.split("/")[1]);
    expect(names.some((n) => n?.startsWith("ability-score-improvement"))).toBe(false);
    expect(names.some((n) => n?.startsWith("mystic-arcanum"))).toBe(false);
    expect(names.some((n) => n?.startsWith("expertise"))).toBe(false);
  });

  it("hides the step before as soon as the next one is reached", () => {
    expect(sheetOf("barbarian", 9).hiddenFeatures).not.toContain(feature("brutal-critical-1-die"));
    const at13 = sheetOf("barbarian", 13);
    expect(at13.hiddenFeatures).toContain(feature("brutal-critical-1-die"));
    expect(at13.hiddenFeatures).not.toContain(feature("brutal-critical-2-dice"));
    expect(at13.superseded[feature("brutal-critical-1-die")]).toBe(
      feature("brutal-critical-2-dice"),
    );
    const at17 = sheetOf("barbarian", 17);
    expect(at17.hiddenFeatures).toEqual(
      expect.arrayContaining([feature("brutal-critical-1-die"), feature("brutal-critical-2-dice")]),
    );
    expect(at17.hiddenFeatures).not.toContain(feature("brutal-critical-3-dice"));
  });

  it("keeps the effects: the replaced feature is still one the character has", () => {
    const sheet = sheetOf("fighter", 20);
    expect(sheet.features).toEqual(
      expect.arrayContaining([
        feature("extra-attack-1"),
        feature("extra-attack-2"),
        feature("extra-attack-3"),
      ]),
    );
    expect(sheet.hiddenFeatures).toEqual(
      expect.arrayContaining([feature("extra-attack-1"), feature("extra-attack-2")]),
    );
    expect(sheet.hiddenFeatures).not.toContain(feature("extra-attack-3"));
  });

  it("lets the person turn a replaced feature back on, and still hide any other", () => {
    const on = sheetOf("barbarian", 13, { [feature("brutal-critical-1-die")]: { hidden: false } });
    expect(on.hiddenFeatures).not.toContain(feature("brutal-critical-1-die"));
    expect(on.superseded[feature("brutal-critical-1-die")]).toBeDefined();
    const own = sheetOf("barbarian", 13, { [feature("rage")]: { hidden: true } });
    expect(own.hiddenFeatures).toEqual(
      expect.arrayContaining([feature("rage"), feature("brutal-critical-1-die")]),
    );
  });

  it("finds nothing replaced when the later step is not held", () => {
    const ids = [feature("brutal-critical-1-die")];
    expect(supersededBy(ids, srd51Index)).toEqual({});
    expect(supersededBy([], srd51Index)).toEqual({});
  });
});
