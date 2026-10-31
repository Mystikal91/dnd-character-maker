import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { parseDice } from "./dice";
import { actionRolls, doubleDice } from "./monsterRolls";

describe("what an action of a creature can roll", () => {
  it("reads the attack and the damage of an action", () => {
    expect(actionRolls({ attackBonus: 5, damage: [{ type: "piercing", dice: "1d6+3" }] })).toEqual({
      attackBonus: 5,
      damage: [{ type: "piercing", dice: "1d6+3" }],
      scaled: false,
    });
    expect(actionRolls({})).toEqual({ damage: [], scaled: false });
  });

  it("leaves out what is not a number or dice", () => {
    expect(
      actionRolls({
        attackBonus: "+5",
        damage: [
          { type: "fire", dice: "your level" },
          { type: "fire", dice: "2d6" },
          { dice: "1d4" },
          null,
          { type: "cold", dice: "3" },
        ],
      }),
    ).toEqual({
      damage: [
        { type: "fire", dice: "2d6" },
        { type: "cold", dice: "3" },
      ],
      scaled: false,
    });
  });

  it("reads every action of the SRD monsters into dice the roller accepts, or a flat number", () => {
    let attacks = 0;
    for (const entry of srd51Index.values()) {
      if (entry.kind !== "monster") continue;
      for (const section of ["special", "actions", "reactions", "legendary"]) {
        for (const action of (entry.data[section] as object[] | undefined) ?? []) {
          const rolls = actionRolls(action);
          if (rolls.attackBonus !== undefined) attacks += 1;
          for (const part of rolls.damage) {
            // A flat number (the badger bites for 1) has no dice to roll.
            if (/^\d+$/.test(part.dice)) continue;
            expect(parseDice(part.dice), `${entry.id} ${part.dice}`).toBeDefined();
            expect(parseDice(doubleDice(part.dice)), `${entry.id} doubled`).toBeDefined();
          }
        }
      }
    }
    expect(attacks).toBeGreaterThan(500);
  });
});

describe("a critical hit", () => {
  it("doubles the dice and keeps the bonus", () => {
    expect(doubleDice("2d6+3")).toBe("4d6+3");
    expect(doubleDice("1d8")).toBe("2d8");
    expect(doubleDice("3")).toBe("3");
    expect(doubleDice("1d4-1")).toBe("2d4-1");
  });
});
