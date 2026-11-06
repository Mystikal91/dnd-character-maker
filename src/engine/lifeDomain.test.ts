import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";
import { spellRolls } from "./spellRolls";

const life = (level: number) => {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/human";
  c.classes = [{ classId: "srd51:class/cleric", level, subclassId: "srd51:subclass/life" }];
  c.abilityBase = { str: 10, dex: 10, con: 12, int: 10, wis: 16, cha: 10 };
  return deriveSheet(c, srd51Index);
};

const cureWounds = { healAtSlotLevel: { "1": "1d8 + MOD", "2": "2d8 + MOD", "3": "3d8 + MOD" } };
const cast = (healing: ReturnType<typeof life>["spellHealing"], slotLevel: number) =>
  spellRolls(cureWounds, { slotLevel, characterLevel: 5, modifier: 3, healing });

describe("the Life domain's healing", () => {
  it("arrives with the levels that give it", () => {
    expect(life(1).spellHealing).toEqual({
      plusSlotLevel: 2,
      maxDice: false,
      selfPlusSlotLevel: 0,
    });
    expect(life(6).spellHealing.selfPlusSlotLevel).toBe(2);
    expect(life(16).spellHealing.maxDice).toBe(false);
    expect(life(17).spellHealing.maxDice).toBe(true);
  });

  it("Disciple of Life adds 2 and the level of the slot", () => {
    expect(cast(life(1).spellHealing, 1).heal).toBe("1d8+3+3");
    expect(cast(life(1).spellHealing, 3).heal).toBe("3d8+3+5");
  });

  it("Blessed Healer heals the cleric 2 and the level of the slot too", () => {
    expect(cast(life(6).spellHealing, 2).selfHeal).toBe(4);
    expect(cast(life(1).spellHealing, 2).selfHeal).toBeUndefined();
  });

  it("Supreme Healing takes the highest number of every die", () => {
    // 2d8 at its best is 16, plus the modifier 3, plus 2 and the slot level 2.
    expect(cast(life(17).spellHealing, 2).healFixed).toBe(16 + 3 + 4);
    expect(cast(life(16).spellHealing, 2).healFixed).toBeUndefined();
  });

  it("leaves a spell without a healing roll, and a cantrip, alone", () => {
    const none = spellRolls(
      {},
      { slotLevel: 1, characterLevel: 5, modifier: 3, healing: life(17).spellHealing },
    );
    expect(none.heal).toBeUndefined();
    const cantrip = spellRolls(cureWounds, {
      slotLevel: 0,
      characterLevel: 5,
      modifier: 3,
      healing: life(17).spellHealing,
    });
    expect(cantrip.healFixed).toBeUndefined();
  });
});

describe("Divine Strike", () => {
  const strike = (level: number) =>
    life(level).extraDamage.find((e) => e.kind === "feature" && e.entry.endsWith("/divine-strike"));

  it("is not there before the 8th level", () => {
    expect(strike(7)).toBeUndefined();
  });

  it("is 1d8 of radiant damage from the 8th level and 2d8 from the 14th", () => {
    expect(strike(8)).toMatchObject({ dice: "1d8", damageType: "radiant", note: "oncePerTurn" });
    expect(strike(13)).toMatchObject({ dice: "1d8" });
    expect(strike(14)).toMatchObject({ dice: "2d8" });
  });
});
