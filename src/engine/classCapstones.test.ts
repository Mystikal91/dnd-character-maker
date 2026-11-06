import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { type Character, createCharacter } from "./character";
import { deriveSheet } from "./derive";
import { explain } from "./explain";

function make(classId: string, level: number, scores: Partial<Character["abilityBase"]> = {}) {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/human";
  c.classes = [{ classId: `srd51:class/${classId}`, level }];
  c.abilityBase = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...scores };
  return c;
}
const sheetOf = (c: Character) => deriveSheet(c, srd51Index);

describe("what the base classes give that changes a number", () => {
  // The human of these characters adds 1 to every score.
  it("the barbarian's Primal Champion adds 4 to Strength and Constitution, and the limit is 24", () => {
    const before = sheetOf(make("barbarian", 19, { str: 19, con: 17 }));
    const after = sheetOf(make("barbarian", 20, { str: 19, con: 17 }));
    expect(before.abilities.str.score).toBe(20);
    expect(after.abilities.str.score).toBe(24);
    expect(after.abilities.con.score).toBe(22);
    expect(after.abilities.str.modifier).toBe(7);
    // 24 is allowed for them, 25 is not.
    expect(after.warnings.some((w) => w.code === "abilityTooHigh")).toBe(false);
    const over = sheetOf(make("barbarian", 20, { str: 20, con: 17 }));
    expect(over.warnings.some((w) => w.code === "abilityTooHigh")).toBe(true);
  });

  it("the rogue's Slippery Mind adds proficiency in Wisdom saves at the 15th level", () => {
    expect(sheetOf(make("rogue", 14, { wis: 14 })).saves.wis.proficient).toBe(false);
    const s = sheetOf(make("rogue", 15, { wis: 14 }));
    expect(s.saves.wis.proficient).toBe(true);
    expect(s.saves.wis.bonus).toBe(2 + 5);
  });

  it("the rogue's Blindsense is blindsight at 10 feet from the 14th level", () => {
    expect(sheetOf(make("rogue", 13)).senses.blindsight).toBeUndefined();
    expect(sheetOf(make("rogue", 14)).senses.blindsight).toBe(10);
  });

  it("the monk's Diamond Soul is proficiency in every saving throw at the 14th level", () => {
    const before = sheetOf(make("monk", 13));
    const after = sheetOf(make("monk", 14));
    expect(Object.values(before.saves).filter((x) => x.proficient)).toHaveLength(2);
    expect(Object.values(after.saves).every((x) => x.proficient)).toBe(true);
  });

  it("the paladin's Aura of Protection adds the Charisma modifier to every save from the 6th level", () => {
    const before = sheetOf(make("paladin", 5, { cha: 16 }));
    const after = sheetOf(make("paladin", 6, { cha: 16 }));
    expect(after.saves.str.bonus).toBe(before.saves.str.bonus + 3);
    expect(after.saves.wis.bonus).toBe(before.saves.wis.bonus + 3);
  });

  it("the aura gives at least +1, and the save explains it and still adds up", () => {
    const low = sheetOf(make("paladin", 6, { cha: 8 }));
    const base = sheetOf(make("paladin", 5, { cha: 8 }));
    expect(low.saves.dex.bonus).toBe(base.saves.dex.bonus + 1);
    const c = make("paladin", 6, { cha: 16 });
    const s = sheetOf(c);
    const result = explain({ kind: "save", ability: "wis" }, s, c, srd51Index);
    expect(result?.lines.reduce((sum, l) => sum + l.value, 0)).toBe(result?.total);
    expect(result?.lines).toContainEqual({
      part: "feature",
      value: 3,
      ref: "srd51:feature/aura-of-protection",
    });
  });

  it("the druid's Archdruid makes Wild Shape unlimited at the 20th level", () => {
    const wild = (level: number) =>
      sheetOf(make("druid", level)).resources.find((r) => r.kind === "wildShape");
    expect(wild(19)).toMatchObject({ max: 2 });
    expect(wild(19)?.unlimited).toBeFalsy();
    expect(wild(20)?.unlimited).toBe(true);
  });
});
