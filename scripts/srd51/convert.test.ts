import { describe, expect, it } from "vitest";
import { type RawSource, cleanData, convertAll } from "./convert";

const ref = (index: string) => ({ index, name: index, url: `/api/2014/x/${index}` });

const raw: RawSource = {
  proficiencies: [
    {
      index: "skill-perception",
      name: "Skill: Perception",
      type: "Skills",
      reference: { index: "perception" },
    },
    {
      index: "battleaxes",
      name: "Battleaxes",
      type: "Weapons",
      reference: { index: "battleaxe" },
    },
  ],
  languages: [
    {
      index: "common",
      name: "Common",
      type: "Standard",
      typical_speakers: ["Humans"],
      script: "Common",
    },
    {
      index: "elvish",
      name: "Elvish",
      type: "Standard",
      typical_speakers: ["Elves"],
      script: "Elvish",
    },
  ],
  races: [
    {
      index: "elf",
      name: "Elf",
      speed: 30,
      size: "Medium",
      age: "old",
      alignment: "chaotic",
      size_description: "tall",
      language_desc: "speaks",
      ability_bonuses: [{ ability_score: ref("dex"), bonus: 2 }],
      languages: [ref("common")],
      traits: [ref("keen-senses")],
    },
  ],
  subraces: [],
  traits: [
    {
      index: "keen-senses",
      name: "Keen Senses",
      desc: ["First.", "Second."],
      proficiencies: [ref("skill-perception")],
    },
    {
      index: "dwarven-combat-training",
      name: "Dwarven Combat Training",
      desc: ["x"],
      proficiencies: [ref("battleaxes")],
    },
  ],
  backgrounds: [],
  spells: [],
  classes: [],
  subclasses: [],
  levels: [],
  features: [],
  equipment: [],
  weaponProperties: [],
  abilityScores: [],
  skills: [],
  magicSchools: [],
  conditions: [],
};

describe("cleanData", () => {
  it("drops urls and camel-cases keys, keeping numeric keys", () => {
    expect(cleanData({ damage_type: { index: "fire", url: "/x" }, at: { "3": "8d6" } })).toEqual({
      damageType: { index: "fire" },
      at: { "3": "8d6" },
    });
  });
});

describe("convertAll", () => {
  const out = convertAll(raw);

  it("maps species ability bonuses, languages and traits to effects", () => {
    expect(out.species.entries[0]).toMatchObject({
      id: "srd51:species/elf",
      data: { speed: 30, size: "medium" },
      effects: [
        { type: "abilityBonus", ability: "dex", value: 2 },
        { type: "proficiency", category: "language", target: "common" },
        { type: "trait", id: "srd51:trait/keen-senses" },
      ],
    });
  });

  it("resolves proficiency indexes into category and target", () => {
    const keen = out.trait.entries.find((e) => e.id === "srd51:trait/keen-senses");
    expect(keen?.effects).toEqual([
      { type: "proficiency", category: "skill", target: "perception" },
    ]);
    const dwarf = out.trait.entries.find((e) => e.id === "srd51:trait/dwarven-combat-training");
    expect(dwarf?.effects).toEqual([
      { type: "proficiency", category: "weapon", target: "battleaxes" },
    ]);
  });

  it("puts text in strings, joining paragraphs", () => {
    expect(out.trait.strings["keen-senses.desc"]).toBe("First.\n\nSecond.");
    expect(out.species.strings["elf.name"]).toBe("Elf");
  });

  it("fails loudly on unknown proficiencies", () => {
    const bad = {
      ...raw,
      traits: [{ index: "t", name: "T", desc: [], proficiencies: [ref("nope")] }],
    };
    expect(() => convertAll(bad)).toThrow(/Unknown proficiency: nope/);
  });
});
