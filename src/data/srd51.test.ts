import { describe, expect, it } from "vitest";
import { createCharacter } from "../engine/character";
import { deriveSheet } from "../engine/derive";
import {
  SRD51_FILES,
  srd51Index as index,
  loadSrd51Pack,
  loadSrd51Strings,
  srd51Packs as packs,
} from "../test/srd51";
import { classData, subclassData } from "./progression";
import { findBrokenReferences } from "./schema";

describe("SRD 5.1 pack", () => {
  it("passes schema validation and has no broken references", () => {
    expect(findBrokenReferences(packs)).toEqual([]);
  });

  it("has a display name for every entry", () => {
    for (const file of SRD51_FILES) {
      const texts = loadSrd51Strings(file);
      for (const entry of loadSrd51Pack(file).entries) {
        const slug = entry.id.split("/")[1] ?? "";
        expect(texts[`${slug}.name`], entry.id).toBeTruthy();
      }
    }
  });

  it("keeps display text out of the data files", () => {
    const spells = loadSrd51Pack("spells").entries;
    expect(spells).toHaveLength(319);
    expect(JSON.stringify(spells)).not.toContain("explosion of flame");
  });

  it("models Fireball structurally", () => {
    const fireball = index.get("srd51:spell/fireball");
    expect(fireball?.data).toMatchObject({
      level: 3,
      school: "evocation",
      concentration: false,
      classes: ["srd51:class/sorcerer", "srd51:class/wizard"],
    });
  });

  it("derives a High Elf from real data, including trait proficiencies", () => {
    const c = createCharacter("srd51");
    c.choices.species = "srd51:species/elf";
    c.choices.subspecies = "srd51:subspecies/high-elf";
    const sheet = deriveSheet(c, index);
    expect(sheet.abilities.dex.score).toBe(12);
    expect(sheet.abilities.int.score).toBe(11);
    expect(sheet.proficiencies.skill).toContain("perception");
    expect(sheet.proficiencies.language).toEqual(expect.arrayContaining(["common", "elvish"]));
    expect(sheet.traits).toEqual(
      expect.arrayContaining(["srd51:trait/keen-senses", "srd51:trait/high-elf-cantrip"]),
    );
    expect(sheet.warnings).toEqual([]);
  });

  it("represents choices as data: Half-Elf ability bonuses and High Elf cantrip", () => {
    const halfElf = index.get("srd51:species/half-elf");
    expect(halfElf?.effects).toContainEqual(
      expect.objectContaining({ type: "choice", grants: "abilityBonus", choose: 2, value: 1 }),
    );
    const cantrip = index.get("srd51:trait/high-elf-cantrip");
    expect(cantrip?.effects).toContainEqual(
      expect.objectContaining({ type: "choice", grants: "spell", choose: 1 }),
    );
  });
});

describe("SRD 5.1 classes", () => {
  const classes = loadSrd51Pack("classes").entries;
  const subclasses = loadSrd51Pack("subclasses").entries;

  it("has all 12 classes with 20 level rows and 12 subclasses", () => {
    expect(classes).toHaveLength(12);
    expect(subclasses).toHaveLength(12);
    for (const entry of classes) expect(classData(entry).levels, entry.id).toHaveLength(20);
  });

  it("resolves every referenced feature, spell and class", () => {
    const missing: string[] = [];
    const need = (from: string, ref: string) => {
      if (!index.has(ref)) missing.push(`${from} -> ${ref}`);
    };
    for (const entry of classes)
      for (const row of classData(entry).levels) for (const f of row.features) need(entry.id, f);
    for (const entry of subclasses) {
      const data = subclassData(entry);
      for (const row of data.levels) for (const f of row.features) need(entry.id, f);
      for (const sp of data.spells) need(entry.id, sp.spell);
    }
    for (const spell of loadSrd51Pack("spells").entries)
      for (const c of spell.data.classes as string[]) need(spell.id, c);
    for (const feature of loadSrd51Pack("features").entries)
      need(feature.id, feature.data.class as string);
    expect(missing).toEqual([]);
  });

  it("describes Wizard spellcasting and the Wizard's saving throws", () => {
    const wizard = index.get("srd51:class/wizard");
    if (!wizard) throw new Error("wizard missing");
    const data = classData(wizard);
    expect(data.hitDie).toBe(6);
    expect(data.spellcasting).toEqual({ ability: "int", startsAtLevel: 1 });
    expect(data.levels[4]).toMatchObject({
      level: 5,
      cantripsKnown: 4,
      spellSlots: [4, 3, 2, 0, 0, 0, 0, 0, 0],
    });
    expect(wizard.effects).toContainEqual({ type: "proficiency", category: "save", target: "int" });
  });

  it("models the Fighter's multiclass requirement as a choice of STR or DEX 13", () => {
    const fighter = index.get("srd51:class/fighter");
    if (!fighter) throw new Error("fighter missing");
    expect(classData(fighter).multiclassing.prerequisiteOptions).toEqual({
      choose: 1,
      from: [
        { ability: "str", minimum: 13 },
        { ability: "dex", minimum: 13 },
      ],
    });
  });
});
