import { describe, expect, it } from "vitest";
import { srd51Index as index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

function highElfWizard() {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/elf";
  c.choices.subspecies = "srd51:subspecies/high-elf";
  c.classes = [{ classId: "srd51:class/wizard", level: 5 }];
  c.abilityBase = { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10 };
  return c;
}

describe("saves, skills and other derived numbers", () => {
  const sheet = deriveSheet(highElfWizard(), index);

  it("adds the proficiency bonus to saves the class is proficient in", () => {
    expect(sheet.saves.int).toEqual({ bonus: 6, proficient: true });
    expect(sheet.saves.wis).toEqual({ bonus: 4, proficient: true });
    expect(sheet.saves.str).toEqual({ bonus: -1, proficient: false });
  });

  it("derives all 18 skills with their ability and proficiency", () => {
    expect(sheet.skills).toHaveLength(18);
    const perception = sheet.skills.find((s) => s.id === "srd51:skill/perception");
    expect(perception).toEqual({
      id: "srd51:skill/perception",
      ability: "wis",
      bonus: 4,
      proficient: true,
    });
    const arcana = sheet.skills.find((s) => s.id === "srd51:skill/arcana");
    expect(arcana).toMatchObject({ ability: "int", bonus: 3, proficient: false });
    expect(sheet.passivePerception).toBe(14);
  });

  it("derives initiative and speed, and lets overrides win", () => {
    expect(sheet.initiative).toBe(3);
    expect(sheet.speed).toBe(30);
    const c = highElfWizard();
    c.overrides.speed = 40;
    c.overrides.initiative = 9;
    expect(deriveSheet(c, index)).toMatchObject({ speed: 40, initiative: 9 });
  });

  it("has no speed until a species is chosen", () => {
    expect(deriveSheet(createCharacter("srd51"), index).speed).toBeUndefined();
  });
});
