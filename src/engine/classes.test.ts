import { describe, expect, it } from "vitest";
import { srd51Index as index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

function highElfWizard(level: number) {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/elf";
  c.choices.subspecies = "srd51:subspecies/high-elf";
  c.classes = [{ classId: "srd51:class/wizard", level }];
  c.abilityBase = { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10 };
  return c;
}

describe("deriveSheet with SRD 5.1 classes", () => {
  it("derives a level 5 High Elf Wizard", () => {
    const sheet = deriveSheet(highElfWizard(5), index);
    expect(sheet.level).toBe(5);
    expect(sheet.proficiencyBonus).toBe(3);
    expect(sheet.abilities.int).toMatchObject({ score: 16, modifier: 3 });
    // Level 1: 6 + 2. Levels 2-5: average 4 + 2 each.
    expect(sheet.hitPoints).toEqual({ max: 32, overridden: false, hitDice: { d6: 5 } });
    expect(sheet.proficiencies.save).toEqual(["int", "wis"]);
    expect(sheet.features).toContain("srd51:feature/arcane-recovery");
    expect(sheet.spellcasting).toEqual({
      classId: "srd51:class/wizard",
      ability: "int",
      saveDc: 14,
      attackBonus: 6,
      cantripsKnown: 4,
      spellSlots: [4, 3, 2, 0, 0, 0, 0, 0, 0],
    });
    expect(sheet.warnings).toEqual([]);
  });

  it("uses recorded hit die rolls instead of the average", () => {
    const c = highElfWizard(3);
    const [wizard] = c.classes;
    if (wizard) wizard.hpRolls = [0, 6, 1];
    // 8 + (6+2) + (1+2) = 19
    expect(deriveSheet(c, index).hitPoints.max).toBe(19);
  });

  it("gives non-spellcasting classes no spellcasting block, and unlocks subclass features", () => {
    const c = createCharacter("srd51");
    c.classes = [
      { classId: "srd51:class/fighter", level: 3, subclassId: "srd51:subclass/champion" },
    ];
    const sheet = deriveSheet(c, index);
    expect(sheet.spellcasting).toBeUndefined();
    expect(sheet.features).toEqual(
      expect.arrayContaining(["srd51:feature/second-wind", "srd51:feature/improved-critical"]),
    );
    expect(sheet.hitPoints.hitDice).toEqual({ d10: 3 });
  });

  it("starts paladin spellcasting at level 2", () => {
    const c = createCharacter("srd51");
    c.classes = [{ classId: "srd51:class/paladin", level: 1 }];
    expect(deriveSheet(c, index).spellcasting).toBeUndefined();
    c.classes = [{ classId: "srd51:class/paladin", level: 2 }];
    expect(deriveSheet(c, index).spellcasting?.spellSlots[0]).toBe(2);
  });

  it("combines levels and hit dice when multiclassing, with starting proficiencies only from the first class", () => {
    const c = createCharacter("srd51");
    c.classes = [
      { classId: "srd51:class/fighter", level: 2 },
      { classId: "srd51:class/wizard", level: 1 },
    ];
    const sheet = deriveSheet(c, index);
    expect(sheet.level).toBe(3);
    expect(sheet.hitPoints.hitDice).toEqual({ d10: 2, d6: 1 });
    expect(sheet.proficiencies.save).toEqual(["str", "con"]);
  });

  it("lets Free edit overrides win for hit points and proficiency bonus", () => {
    const c = highElfWizard(5);
    c.overrides["hp.max"] = 99;
    c.overrides.proficiencyBonus = 4;
    const sheet = deriveSheet(c, index);
    expect(sheet.hitPoints).toMatchObject({ max: 99, overridden: true });
    expect(sheet.proficiencyBonus).toBe(4);
    expect(sheet.spellcasting?.saveDc).toBe(15);
  });

  it("warns about a subclass that belongs to another class", () => {
    const c = createCharacter("srd51");
    c.classes = [
      { classId: "srd51:class/wizard", level: 3, subclassId: "srd51:subclass/champion" },
    ];
    expect(deriveSheet(c, index).warnings).toContainEqual({
      code: "subclassMismatch",
      params: { subclass: "srd51:subclass/champion", class: "srd51:class/wizard" },
    });
  });
});
