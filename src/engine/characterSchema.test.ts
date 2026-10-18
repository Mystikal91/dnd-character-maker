import { describe, expect, it } from "vitest";
import { createCharacter } from "./character";
import { CharacterParseError, parseCharacter } from "./characterSchema";

describe("parseCharacter", () => {
  it("accepts a character and returns an equal copy", () => {
    const c = createCharacter("srd51");
    c.name = "Elowen";
    c.choices.species = "srd51:species/elf";
    c.classes = [{ classId: "srd51:class/wizard", level: 3, hpRolls: [0, 4, 5] }];
    c.inventory = [{ itemId: "srd51:item/dagger", quantity: 2, equipped: true }];
    c.overrides.ac = 15;
    expect(parseCharacter(JSON.parse(JSON.stringify(c)))).toEqual(c);
  });

  it.each([
    ["a non-object", 42],
    ["a missing schemaVersion", { ...createCharacter("srd51"), schemaVersion: undefined }],
    ["a newer schemaVersion", { ...createCharacter("srd51"), schemaVersion: 99 }],
    ["an unknown ruleset", { ...createCharacter("srd51"), ruleset: "dnd35" }],
    [
      "a level above 20",
      { ...createCharacter("srd51"), classes: [{ classId: "x:class/y", level: 21 }] },
    ],
    ["a non-numeric ability score", { ...createCharacter("srd51"), abilityBase: { str: "10" } }],
    ["an empty id", { ...createCharacter("srd51"), id: "" }],
  ])("rejects %s", (_label, input) => {
    expect(() => parseCharacter(input)).toThrow(CharacterParseError);
  });
});
