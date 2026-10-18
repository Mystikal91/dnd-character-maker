import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createCharacter } from "../engine/character";
import { deriveSheet, indexPacks } from "../engine/derive";
import { type Pack, findBrokenReferences, parsePack } from "./schema";

// Checks the committed output of `npm run data:srd51`; no network needed.
const FILES = ["species", "subspecies", "traits", "backgrounds", "spells"] as const;

function load(file: string): Pack {
  return parsePack(JSON.parse(readFileSync(`data/srd51/${file}.json`, "utf8")));
}
function strings(file: string): Record<string, string> {
  return JSON.parse(readFileSync(`locales/en/srd51/${file}.json`, "utf8"));
}

const packs = FILES.map(load);
const index = indexPacks(...packs);

describe("SRD 5.1 pack", () => {
  it("passes schema validation and has no broken references", () => {
    expect(findBrokenReferences(packs)).toEqual([]);
  });

  it("has a display name for every entry", () => {
    for (const file of FILES) {
      const texts = strings(file);
      for (const entry of load(file).entries) {
        const slug = entry.id.split("/")[1] ?? "";
        expect(texts[`${slug}.name`], entry.id).toBeTruthy();
      }
    }
  });

  it("keeps display text out of the data files", () => {
    const spells = load("spells").entries;
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
