import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { type SpellRollData, spellRolls } from "./spellRolls";

const spell = (slug: string) => srd51Index.get(`srd51:spell/${slug}`)?.data as SpellRollData;
const at = (slug: string, slotLevel: number, characterLevel = 5, modifier = 3) =>
  spellRolls(spell(slug), { slotLevel, characterLevel, modifier });

describe("what a spell rolls", () => {
  it("takes the damage of the slot it is cast with", () => {
    expect(at("fireball", 3).damage).toEqual([{ type: "fire", dice: "8d6" }]);
    expect(at("fireball", 5).damage).toEqual([{ type: "fire", dice: "10d6" }]);
    expect(at("fireball", 3)).toMatchObject({ attack: false, save: "dex", scalesBySlot: true });
  });

  it("takes the damage of a cantrip from the level of the character", () => {
    expect(at("fire-bolt", 0, 1).damage[0]?.dice).toBe("1d10");
    expect(at("fire-bolt", 0, 5).damage[0]?.dice).toBe("2d10");
    expect(at("fire-bolt", 0, 17).damage[0]?.dice).toBe("4d10");
    expect(at("fire-bolt", 0, 5)).toMatchObject({ attack: true, scalesBySlot: false });
  });

  it("puts the spellcasting modifier into healing, and keeps a flat bonus of the table", () => {
    expect(at("cure-wounds", 1, 5, 3).heal).toBe("1d8+3");
    expect(at("cure-wounds", 2, 5, -1).heal).toBe("2d8-1");
    expect(at("cure-wounds", 1, 5, 0).heal).toBe("1d8");
    expect(at("magic-missile", 1).damage[0]?.dice).toBe("3d4+3");
  });

  it("does not know what a spell without data rolls", () => {
    expect(at("alarm", 1)).toEqual({ attack: false, damage: [], scalesBySlot: false });
  });
});
