import { describe, expect, it } from "vitest";
import { parsePack } from "../data/schema";
import { createCharacter } from "./character";
import { deriveSheet, indexPacks } from "./derive";

// Synthetic test data, not rules content.
const testPack = parsePack({
  manifest: {
    id: "test",
    ruleset: "custom",
    version: "0.0.0",
    license: "CC-BY-4.0",
    attribution: "Test data",
  },
  entries: [
    {
      id: "test:species/elf",
      kind: "species",
      effects: [
        { type: "abilityBonus", ability: "dex", value: 2 },
        { type: "proficiency", category: "skill", target: "perception" },
        { type: "trait", id: "test:trait/keen-senses" },
      ],
    },
    {
      id: "test:subspecies/high-elf",
      kind: "subspecies",
      parent: "test:species/elf",
      effects: [
        { type: "abilityBonus", ability: "int", value: 1 },
        { type: "proficiency", category: "skill", target: "perception" },
      ],
    },
    {
      id: "test:trait/keen-senses",
      kind: "trait",
      effects: [{ type: "proficiency", category: "skill", target: "perception" }],
    },
  ],
});

const index = indexPacks(testPack);

function elf() {
  const c = createCharacter("srd51");
  c.choices.species = "test:species/elf";
  c.choices.subspecies = "test:subspecies/high-elf";
  c.abilityBase.int = 14;
  c.abilityBase.dex = 12;
  return c;
}

describe("deriveSheet", () => {
  it("applies species and subspecies ability bonuses", () => {
    const { abilities } = deriveSheet(elf(), index);
    expect(abilities.dex).toMatchObject({ base: 12, bonus: 2, score: 14, modifier: 2 });
    expect(abilities.int).toMatchObject({ base: 14, bonus: 1, score: 15, modifier: 2 });
    expect(abilities.str).toMatchObject({ bonus: 0, score: 10, modifier: 0 });
  });

  it("collects proficiencies without duplicates, and traits", () => {
    const sheet = deriveSheet(elf(), index);
    expect(sheet.proficiencies.skill).toEqual(["perception"]);
    expect(sheet.traits).toEqual(["test:trait/keen-senses"]);
  });

  it("lets a Free edit override win over the computed score", () => {
    const c = elf();
    c.overrides["ability.int"] = 18;
    const { abilities } = deriveSheet(c, index);
    expect(abilities.int).toMatchObject({ score: 18, modifier: 4, overridden: true });
    expect(abilities.dex.overridden).toBe(false);
  });

  it("warns, without failing, on unknown entries and scores above 20", () => {
    const c = elf();
    c.choices.background = "test:background/missing";
    c.abilityBase.dex = 19;
    const sheet = deriveSheet(c, index);
    expect(sheet.warnings).toEqual([
      { code: "unknownEntry", params: { id: "test:background/missing" } },
      { code: "abilityTooHigh", params: { ability: "dex", score: 21 } },
    ]);
    expect(sheet.abilities.dex.score).toBe(21);
  });
});
