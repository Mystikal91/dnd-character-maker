import { describe, expect, it } from "vitest";
import { srd51Index as index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";
import { OVERRIDE, countOverrides, numberOverride, withOverride } from "./overrides";

function wizard() {
  const c = createCharacter("srd51");
  c.classes = [{ classId: "srd51:class/wizard", level: 5 }];
  c.abilityBase = { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 };
  return c;
}

describe("override helpers", () => {
  it("adds, replaces and removes a forced value without touching the others", () => {
    const one = withOverride({}, "ac", 18);
    const two = withOverride(one, "speed", 40);
    expect(two).toEqual({ ac: 18, speed: 40 });
    expect(withOverride(two, "ac", 20)).toEqual({ speed: 40, ac: 20 });
    expect(withOverride(two, "ac", undefined)).toEqual({ speed: 40 });
  });

  it("reads only real numbers and counts them", () => {
    const overrides = { ac: 18, note: "x", flag: true, bad: Number.NaN };
    expect(numberOverride(overrides, "ac")).toBe(18);
    expect(numberOverride(overrides, "note")).toBeUndefined();
    expect(numberOverride(overrides, "bad")).toBeUndefined();
    expect(numberOverride(overrides, "missing")).toBeUndefined();
    expect(countOverrides(overrides)).toBe(2);
  });
});

describe("forced values in the sheet", () => {
  it("replaces a saving throw bonus and a skill bonus, and passive Perception follows", () => {
    const c = wizard();
    const normal = deriveSheet(c, index);
    expect(normal.saves.int.bonus).toBe(6); // +3 INT, +3 proficiency
    c.overrides[OVERRIDE.save("int")] = 9;
    c.overrides[OVERRIDE.skill("perception")] = 8;
    const forced = deriveSheet(c, index);
    expect(forced.saves.int.bonus).toBe(9);
    expect(forced.saves.int.proficient).toBe(true); // proficiency itself is unchanged
    expect(forced.skills.find((s) => s.id.endsWith("/perception"))?.bonus).toBe(8);
    expect(forced.passivePerception).toBe(18);
    expect(forced.saves.wis.bonus).toBe(normal.saves.wis.bonus); // others untouched
  });

  it("replaces the spell save DC and spell attack bonus", () => {
    const c = wizard();
    expect(deriveSheet(c, index).spellcasting).toMatchObject({ saveDc: 14, attackBonus: 6 });
    c.overrides[OVERRIDE.spellSaveDc] = 17;
    c.overrides[OVERRIDE.spellAttack] = 9;
    expect(deriveSheet(c, index).spellcasting).toMatchObject({ saveDc: 17, attackBonus: 9 });
  });

  it("keeps working when everything the engine derives is forced at once", () => {
    const c = wizard();
    c.overrides[OVERRIDE.armorClass] = 21;
    c.overrides[OVERRIDE.hitPoints] = 99;
    c.overrides[OVERRIDE.speed] = 45;
    c.overrides[OVERRIDE.initiative] = 7;
    c.overrides[OVERRIDE.proficiencyBonus] = 5;
    c.overrides[OVERRIDE.ability("int")] = 22;
    const sheet = deriveSheet(c, index);
    expect(sheet).toMatchObject({ initiative: 7, speed: 45, proficiencyBonus: 5 });
    expect(sheet.armorClass.value).toBe(21);
    expect(sheet.hitPoints.max).toBe(99);
    expect(sheet.abilities.int).toMatchObject({ score: 22, modifier: 6, overridden: true });
    expect(sheet.warnings).toEqual([]); // a forced score above 20 is the player's choice
  });
});
