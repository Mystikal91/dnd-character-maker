import { describe, expect, it } from "vitest";
import { srd51Index as index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";
import { MULTICLASS_SLOTS, casterLevel, slotPools } from "./multiclass";

function multiclass(classes: { id: string; level: number }[], scores = {}) {
  const c = createCharacter("srd51");
  c.classes = classes.map((x) => ({ classId: `srd51:class/${x.id}`, level: x.level }));
  c.abilityBase = { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 14, ...scores };
  return c;
}

describe("multiclass spell slots", () => {
  it("combines full casters into one caster level", () => {
    const sheet = deriveSheet(
      multiclass([
        { id: "wizard", level: 3 },
        { id: "cleric", level: 2 },
      ]),
      index,
    );
    // Caster level 5.
    expect(sheet.spellSlots).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0]);
    expect(sheet.spellcasters.map((c) => c.classId)).toEqual([
      "srd51:class/wizard",
      "srd51:class/cleric",
    ]);
    // Both classes use the shared slots.
    for (const caster of sheet.spellcasters) expect(caster.spellSlots).toEqual(sheet.spellSlots);
    expect(sheet.warnings).toEqual([]);
  });

  it("counts half of a paladin's or ranger's levels, rounded down", () => {
    const sheet = deriveSheet(
      multiclass([
        { id: "wizard", level: 2 },
        { id: "paladin", level: 5 },
      ]),
      index,
    );
    // 2 + floor(5 / 2) = 4.
    expect(sheet.spellSlots).toEqual([4, 3, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("keeps a single casting class on its own table", () => {
    const sheet = deriveSheet(
      multiclass([
        { id: "paladin", level: 5 },
        { id: "fighter", level: 2 },
      ]),
      index,
    );
    // Paladin 5 has its own table (4 first-level and 2 second-level slots), not the half-caster formula.
    expect(sheet.spellSlots).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0]);
    expect(sheet.spellcasters).toHaveLength(1);
  });

  it("keeps Pact Magic apart when a warlock multiclasses with another caster", () => {
    const sheet = deriveSheet(
      multiclass([
        { id: "wizard", level: 3 },
        { id: "warlock", level: 3 },
      ]),
      index,
    );
    expect(sheet.spellSlots).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0]);
    expect(sheet.pactSlots).toEqual({ level: 2, count: 2 });
  });

  it("shows a lone warlock's slots like any other class", () => {
    const sheet = deriveSheet(multiclass([{ id: "warlock", level: 3 }]), index);
    expect(sheet.spellSlots).toEqual([0, 2, 0, 0, 0, 0, 0, 0, 0]);
    expect(sheet.pactSlots).toBeUndefined();
  });

  it("has no slots for characters that cast nothing", () => {
    const sheet = deriveSheet(multiclass([{ id: "fighter", level: 4 }]), index);
    expect(sheet.spellcasters).toEqual([]);
    expect(sheet.spellSlots.every((n) => n === 0)).toBe(true);
  });
});

describe("multiclass tables", () => {
  it("has a row for every caster level up to 20", () => {
    expect(MULTICLASS_SLOTS).toHaveLength(20);
  });

  it("matches the full caster table of the wizard at each level", () => {
    for (let level = 1; level <= 20; level++) {
      const wizard = deriveSheet(multiclass([{ id: "wizard", level }]), index).spellSlots;
      expect(MULTICLASS_SLOTS[level - 1]).toEqual(wizard);
    }
  });

  it("ignores pact casters when working out the caster level", () => {
    expect(
      casterLevel([
        { kind: "full", level: 4, ownSlots: [] },
        { kind: "pact", level: 5, ownSlots: [] },
      ]),
    ).toBe(4);
    expect(slotPools([]).slots.every((n) => n === 0)).toBe(true);
  });
});

describe("multiclass prerequisites", () => {
  it("warns when an ability is below what a class asks for", () => {
    const sheet = deriveSheet(
      multiclass(
        [
          { id: "wizard", level: 3 },
          { id: "fighter", level: 1 },
        ],
        { str: 8, dex: 10, int: 13 },
      ),
      index,
    );
    const codes = sheet.warnings.filter((w) => w.code === "multiclassPrerequisite");
    expect(codes.length).toBeGreaterThan(0);
    expect(codes.every((w) => w.params.class === "srd51:class/fighter")).toBe(true);
  });

  it("is quiet when the abilities are high enough, and for a single class", () => {
    expect(
      deriveSheet(
        multiclass([
          { id: "wizard", level: 3 },
          { id: "fighter", level: 1 },
        ]),
        index,
      ).warnings,
    ).toEqual([]);
    expect(
      deriveSheet(multiclass([{ id: "fighter", level: 3 }], { str: 8, dex: 8 }), index).warnings,
    ).toEqual([]);
  });
});
