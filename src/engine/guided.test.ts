import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { srd51Index as index } from "../test/srd51";
import { createCharacter } from "./character";
import { parseCharacter } from "./characterSchema";
import { deriveSheet } from "./derive";

const choiceKey = (source: string, id: string) => `${source}/${id}`;

describe("guided choices", () => {
  it("lists the choices offered by species, traits, class and background", () => {
    const c = createCharacter("srd51");
    c.choices.species = "srd51:species/elf";
    c.choices.subspecies = "srd51:subspecies/high-elf";
    c.choices.background = "srd51:background/acolyte";
    c.classes = [{ classId: "srd51:class/wizard", level: 1 }];
    const keys = deriveSheet(c, index).choices.map((ch) => `${ch.grants}:${ch.choose}`);
    expect(keys).toEqual(
      expect.arrayContaining([
        "language:1", // High Elf extra language
        "spell:1", // High Elf cantrip
        "language:2", // Acolyte languages
        "proficiency:2", // Wizard skills
      ]),
    );
    const open = deriveSheet(c, index).choices.every((ch) => ch.remaining === ch.choose);
    expect(open).toBe(true);
  });

  it("applies picked options as if they were fixed effects", () => {
    const c = createCharacter("srd51");
    c.choices.species = "srd51:species/elf";
    c.choices.subspecies = "srd51:subspecies/high-elf";
    c.classes = [{ classId: "srd51:class/wizard", level: 1 }];
    c.selections[choiceKey("srd51:class/wizard", "wizard-proficiency-1")] = [
      "skill:arcana",
      "skill:history",
    ];
    c.selections[choiceKey("srd51:trait/extra-language", "extra-language-language")] = ["dwarvish"];
    c.selections[choiceKey("srd51:trait/high-elf-cantrip", "high-elf-cantrip-spell")] = [
      "srd51:spell/fire-bolt",
    ];
    const sheet = deriveSheet(c, index);
    expect(sheet.proficiencies.skill).toEqual(expect.arrayContaining(["arcana", "history"]));
    expect(sheet.proficiencies.language).toContain("dwarvish");
    expect(sheet.grantedSpells).toEqual(["srd51:spell/fire-bolt"]);
    expect(sheet.skills.find((s) => s.id === "srd51:skill/arcana")?.proficient).toBe(true);
    const skillChoice = sheet.choices.find((ch) => ch.id === "wizard-proficiency-1");
    expect(skillChoice).toMatchObject({
      remaining: 0,
      selected: ["skill:arcana", "skill:history"],
    });
    expect(sheet.warnings).toEqual([]);
  });

  it("applies ability bonuses picked for a Half-Elf", () => {
    const c = createCharacter("srd51");
    c.choices.species = "srd51:species/half-elf";
    c.selections[choiceKey("srd51:species/half-elf", "half-elf-ability")] = ["str", "con"];
    const { abilities } = deriveSheet(c, index);
    expect(abilities.cha.bonus).toBe(2);
    expect(abilities.str.bonus).toBe(1);
    expect(abilities.con.bonus).toBe(1);
    expect(abilities.dex.bonus).toBe(0);
  });

  it("ignores invalid and surplus picks, with warnings", () => {
    const c = createCharacter("srd51");
    c.choices.species = "srd51:species/half-elf";
    c.selections[choiceKey("srd51:species/half-elf", "half-elf-ability")] = [
      "cha", // not an option (Charisma is already +2)
      "str",
      "dex",
      "con", // beyond the two allowed
    ];
    const sheet = deriveSheet(c, index);
    expect(sheet.abilities.str.bonus).toBe(1);
    expect(sheet.abilities.dex.bonus).toBe(1);
    expect(sheet.abilities.con.bonus).toBe(0);
    expect(sheet.warnings).toEqual([
      { code: "invalidChoice", params: { source: "srd51:species/half-elf", option: "cha" } },
      { code: "tooManyChoices", params: { source: "srd51:species/half-elf" } },
    ]);
  });

  it("does not offer choices of classes other than the starting one", () => {
    const c = createCharacter("srd51");
    c.classes = [
      { classId: "srd51:class/fighter", level: 1 },
      { classId: "srd51:class/wizard", level: 1 },
    ];
    const sources = deriveSheet(c, index).choices.map((ch) => ch.source);
    expect(sources).toContain("srd51:class/fighter");
    expect(sources).not.toContain("srd51:class/wizard");
  });
});

describe("ability score improvements", () => {
  function fighter(level: number) {
    const c = createCharacter("srd51");
    c.classes = [{ classId: "srd51:class/fighter", level }];
    c.abilityBase = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
    return c;
  }

  it("makes slots available at the levels the class table gives", () => {
    expect(deriveSheet(fighter(3), index).asi).toEqual({ available: 0, used: 0 });
    expect(deriveSheet(fighter(4), index).asi).toEqual({ available: 1, used: 0 });
    expect(deriveSheet(fighter(6), index).asi.available).toBe(2);
  });

  it("applies +2 to one ability or +1 to two", () => {
    const c = fighter(6);
    c.asi = [["str"], ["dex", "con"]];
    const { abilities, asi } = deriveSheet(c, index);
    expect(abilities.str.score).toBe(17);
    expect(abilities.dex.score).toBe(15);
    expect(abilities.con.score).toBe(14);
    expect(asi).toEqual({ available: 2, used: 2 });
  });

  it("warns about unavailable or malformed improvements and ignores them", () => {
    const c = fighter(4);
    c.asi = [["str", "str"], ["dex"]];
    const sheet = deriveSheet(c, index);
    expect(sheet.abilities.str.score).toBe(15);
    expect(sheet.abilities.dex.score).toBe(14);
    expect(sheet.warnings).toEqual(
      expect.arrayContaining([
        { code: "asiTooMany", params: { available: 1 } },
        { code: "asiInvalid", params: { slot: 1 } },
      ]),
    );
  });
});

describe("feats", () => {
  const feat = {
    id: "test:feat/sturdy",
    kind: "feat",
    effects: [{ type: "abilityBonus", ability: "con", value: 1 }],
    data: { prerequisites: [{ ability: "str", minimum: 17 }] },
  } as unknown as Entry;
  const withFeat = new Map([...index, [feat.id, feat]]);

  function fighter(level: number) {
    const c = createCharacter("srd51");
    c.classes = [{ classId: "srd51:class/fighter", level }];
    c.abilityBase = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
    return c;
  }

  it("uses an improvement slot, applies its effects and checks its prerequisite", () => {
    const c = fighter(4);
    c.feats = [feat.id];
    const sheet = deriveSheet(c, withFeat);
    expect(sheet.feats).toEqual([feat.id]);
    expect(sheet.abilities.con.score).toBe(14);
    expect(sheet.asi).toEqual({ available: 1, used: 1 });
    expect(sheet.warnings).toEqual(
      expect.arrayContaining([
        { code: "featPrerequisite", params: { feat: feat.id, ability: "str", minimum: 17 } },
      ]),
    );
  });

  it("gives the rogue the improvements of the SRD table", () => {
    const rogue = createCharacter("srd51");
    rogue.classes = [{ classId: "srd51:class/rogue", level: 12 }];
    expect(deriveSheet(rogue, index).asi.available).toBe(4);
    rogue.classes = [{ classId: "srd51:class/rogue", level: 19 }];
    expect(deriveSheet(rogue, index).asi.available).toBe(6);
  });
});

describe("character migration", () => {
  it("upgrades a version 1 character to the current version with empty guided state", () => {
    const v1 = {
      id: "old",
      schemaVersion: 1,
      ruleset: "srd51",
      name: "Old hero",
      choices: { species: "srd51:species/elf" },
      classes: [{ classId: "srd51:class/wizard", level: 2 }],
      inventory: [],
      abilityBase: { str: 8, dex: 14, con: 12, int: 16, wis: 10, cha: 10 },
      overrides: {},
    };
    const upgraded = parseCharacter(v1);
    expect(upgraded).toMatchObject({
      schemaVersion: 6,
      feats: [],
      story: { ideals: "", notes: "" },
      spells: {},
      play: { tempHp: 0, conditions: [], inspiration: false },
      abilityMethod: "manual",
      selections: {},
      asi: [],
      name: "Old hero",
      abilityBase: v1.abilityBase,
    });
  });
});
