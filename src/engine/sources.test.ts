import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

function sheetOf(levels: { classId: string; level: number }[]) {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/dwarf";
  c.classes = levels;
  return deriveSheet(c, srd51Index);
}

describe("where a feature comes from", () => {
  it("names the class and the level that grant a class feature", () => {
    const sheet = sheetOf([{ classId: "srd51:class/rogue", level: 3 }]);
    expect(sheet.features.length).toBeGreaterThan(0);
    for (const id of sheet.features) {
      const source = sheet.featureSources[id];
      expect(source?.entry, id).toBe("srd51:class/rogue");
      expect(source?.level).toBeGreaterThanOrEqual(1);
      expect(source?.level).toBeLessThanOrEqual(3);
    }
  });

  it("tells a multiclass character which class gives which", () => {
    const sheet = sheetOf([
      { classId: "srd51:class/fighter", level: 1 },
      { classId: "srd51:class/rogue", level: 1 },
    ]);
    const entries = new Set(sheet.features.map((id) => sheet.featureSources[id]?.entry));
    expect(entries).toEqual(new Set(["srd51:class/fighter", "srd51:class/rogue"]));
  });

  it("traces the traits of the species back to it", () => {
    const sheet = sheetOf([{ classId: "srd51:class/fighter", level: 1 }]);
    expect(sheet.traits.length).toBeGreaterThan(0);
    const fromSpecies = sheet.traits.filter((id) =>
      String(sheet.featureSources[id]?.entry).startsWith("srd51:species/"),
    );
    expect(fromSpecies.length).toBeGreaterThan(0);
    expect(sheet.featureSources[fromSpecies[0] ?? ""]?.level).toBeUndefined();
  });
});
