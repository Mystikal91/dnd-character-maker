import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

function sheetOf(classId: string, level: number, subclassId?: string) {
  const c = createCharacter("srd51");
  c.classes = [{ classId: `srd51:class/${classId}`, level, ...(subclassId && { subclassId }) }];
  return deriveSheet(c, srd51Index);
}

describe("rules of the d20", () => {
  it("lowers the critical range with Improved and Superior Critical", () => {
    const champion = "srd51:subclass/champion";
    expect(sheetOf("fighter", 3).critRange).toBe(20);
    expect(sheetOf("fighter", 3, champion).critRange).toBe(19);
    expect(sheetOf("fighter", 14, champion).critRange).toBe(19);
    expect(sheetOf("fighter", 15, champion).critRange).toBe(18);
  });

  it("gives a rogue of level 11 a minimum of 10 on the skills they are proficient in", () => {
    expect(sheetOf("rogue", 10).proficientSkillFloor).toBe(0);
    expect(sheetOf("rogue", 11).proficientSkillFloor).toBe(10);
    expect(sheetOf("fighter", 11).proficientSkillFloor).toBe(0);
  });

  it("makes a monk of level 10 and a paladin of level 10 immune to the conditions their features name", () => {
    expect(sheetOf("monk", 9).conditionImmunities).toEqual([]);
    const monk = sheetOf("monk", 10);
    expect(monk.conditionImmunities).toEqual(["srd51:condition/poisoned"]);
    expect(monk.defenses.immunity).toContain("poison");
    expect(sheetOf("paladin", 10).conditionImmunities).toEqual(["srd51:condition/frightened"]);
  });
});
