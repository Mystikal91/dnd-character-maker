import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { type Character, createCharacter } from "./character";
import { deriveSheet } from "./derive";
import { type ExplainTarget, explain } from "./explain";

function make(classId: string, level: number, scores: Partial<Character["abilityBase"]> = {}) {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/human";
  c.classes = [{ classId: `srd51:class/${classId}`, level }];
  c.abilityBase = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...scores };
  return c;
}
const explained = (c: Character, target: ExplainTarget) => {
  const sheet = deriveSheet(c, srd51Index);
  return { sheet, result: explain(target, sheet, c, srd51Index) };
};
const sum = (lines: { value: number }[]) => lines.reduce((total, l) => total + l.value, 0);

describe("the martial save DC", () => {
  it("is 8 + proficiency + the better of Strength and Dexterity", () => {
    expect(deriveSheet(make("fighter", 5, { str: 16, dex: 12 }), srd51Index).martialSaveDc).toBe(
      8 + 3 + 3,
    );
    expect(deriveSheet(make("rogue", 1, { str: 8, dex: 16 }), srd51Index).martialSaveDc).toBe(
      8 + 2 + 3,
    );
  });

  it("is taken apart into its three parts, which add up", () => {
    const { sheet, result } = explained(make("rogue", 5, { dex: 16 }), { kind: "martialDc" });
    expect(result?.total).toBe(sheet.martialSaveDc);
    expect(sum(result?.lines ?? [])).toBe(sheet.martialSaveDc);
    expect(result?.lines.map((l) => l.part)).toEqual(["base", "ability", "proficiency"]);
    expect(result?.lines[1]?.ref).toBe("dex");
  });
});

describe("the other quick numbers, taken apart", () => {
  it("passive Perception is 10 and what the check adds", () => {
    const { sheet, result } = explained(make("cleric", 5, { wis: 16 }), {
      kind: "passivePerception",
    });
    expect(result?.total).toBe(sheet.passivePerception);
    expect(sum(result?.lines ?? [])).toBe(sheet.passivePerception);
    expect(result?.lines[0]).toEqual({ part: "base", value: 10 });
  });

  it("the spell save DC and the spell attack add up to what the sheet shows", () => {
    const c = make("wizard", 5, { int: 16 });
    const dc = explained(c, { kind: "spellDc" });
    const caster = dc.sheet.spellcasters[0];
    expect(dc.result?.total).toBe(caster?.saveDc);
    expect(sum(dc.result?.lines ?? [])).toBe(caster?.saveDc);
    const attack = explained(c, { kind: "spellAttack" });
    expect(attack.result?.total).toBe(caster?.attackBonus);
    expect(sum(attack.result?.lines ?? [])).toBe(caster?.attackBonus);
  });

  it("has nothing to explain for a spell number when the character casts no spells", () => {
    expect(explained(make("fighter", 1), { kind: "spellDc" }).result).toBeUndefined();
  });
});

describe("the martial save DC in free edit", () => {
  it("takes the number the person forces, and the explanation says it is forced", () => {
    const c = make("fighter", 5, { str: 16, dex: 12 });
    const calculated = deriveSheet(c, srd51Index).martialSaveDc;
    expect(calculated).toBe(8 + 3 + 3);
    c.overrides["martial.dc"] = 18;
    const { sheet, result } = explained(c, { kind: "martialDc" });
    expect(sheet.martialSaveDc).toBe(18);
    expect(result?.forced).toBe(true);
    expect(result?.total).toBe(18);
    // The lines still show how the book works it out.
    expect(sum(result?.lines ?? [])).toBe(calculated);
  });
});
