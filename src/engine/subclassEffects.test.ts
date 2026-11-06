import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { type Character, createCharacter } from "./character";
import { deriveSheet } from "./derive";

function make(classId: string, subclass: string, level: number) {
  const c: Character = createCharacter("srd51");
  c.choices.species = "srd51:species/human";
  c.classes = [
    { classId: `srd51:class/${classId}`, level, subclassId: `srd51:subclass/${subclass}` },
  ];
  c.abilityBase = { str: 10, dex: 14, con: 12, int: 10, wis: 14, cha: 14 };
  return c;
}
const sheetOf = (c: Character) => deriveSheet(c, srd51Index);

describe("what the subclasses give that the vocabulary holds", () => {
  it("the Life domain gives proficiency with heavy armor at the 1st level", () => {
    expect(sheetOf(make("cleric", "life", 1)).proficiencies.armor).toContain("heavy-armor");
  });

  it("the College of Lore offers three skills at the 3rd level, not before", () => {
    const asks = (level: number) =>
      sheetOf(make("bard", "lore", level)).choices.find(
        (p) => p.source === "srd51:feature/bonus-proficiencies",
      );
    expect(asks(2)).toBeUndefined();
    expect(asks(3)?.choose).toBe(3);
  });

  it("the Circle of the Land offers one more druid cantrip at the 2nd level", () => {
    const pick = sheetOf(make("druid", "land", 2)).choices.find(
      (p) => p.source === "srd51:feature/bonus-cantrip",
    );
    expect(pick?.choose).toBe(1);
    expect(pick?.options.length).toBeGreaterThan(5);
    expect(pick?.options.every((o) => o.startsWith("srd51:spell/"))).toBe(true);
  });

  it("the Thief climbs as fast as he walks from the 3rd level", () => {
    const before = sheetOf(make("rogue", "thief", 2));
    const after = sheetOf(make("rogue", "thief", 3));
    expect(before.movement.climb).toEqual({ feet: (before.speed ?? 0) / 2, half: true });
    expect(after.movement.climb).toEqual({ feet: after.speed });
  });

  it("the Draconic sorcerer flies at his walking speed from the 14th level", () => {
    expect(sheetOf(make("sorcerer", "draconic", 13)).movement.fly).toBeUndefined();
    const wings = sheetOf(make("sorcerer", "draconic", 14));
    expect(wings.movement.fly).toEqual({ feet: wings.speed });
  });

  it("Peerless Skill spends a Bardic Inspiration", () => {
    const s = sheetOf(make("bard", "lore", 14));
    expect(s.spends["srd51:feature/peerless-skill"]).toMatchObject({
      pool: "bardicInspiration",
      cost: 1,
    });
  });
});
