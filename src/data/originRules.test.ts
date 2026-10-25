import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "../engine/character";
import { deriveSheet } from "../engine/derive";

const tiefling = (level: number, subspecies?: string) => {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/tiefling";
  if (subspecies) c.choices.subspecies = subspecies;
  c.classes = [{ classId: "srd51:class/fighter", level }];
  return deriveSheet(c, srd51Index);
};

describe("the species of the SRD with the rules of the books", () => {
  it("gives the Tiefling the spells of the infernal legacy, each from its level", () => {
    expect(tiefling(1).grantedSpells).toEqual(["srd51:spell/thaumaturgy"]);
    expect(tiefling(3).grantedSpells).toContain("srd51:spell/hellish-rebuke");
    expect(tiefling(3).grantedSpells).not.toContain("srd51:spell/darkness");
    expect(tiefling(5).grantedSpells).toContain("srd51:spell/darkness");
  });

  it("gives the increases of a species unless a flag of a sub-race takes them away", () => {
    expect(tiefling(1).abilities.cha.bonus).toBe(2);
    expect(tiefling(1).abilities.int.bonus).toBe(1);
  });
});
