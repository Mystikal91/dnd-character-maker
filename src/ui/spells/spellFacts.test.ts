// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { spellFacts } from "./spellFacts";

const ability = (index: string) => index.toUpperCase();

describe("what a spell does, as rows for its details", () => {
  it("writes the damage that grows with the slot, with the modifier in words", () => {
    const rows = spellFacts(
      {
        attackType: "melee",
        damage: [
          {
            damageType: { index: "force" },
            damageAtSlotLevel: { "2": "1d8 + MOD", "4": "2d8 + MOD", "9": "4d8 + MOD" },
          },
        ],
      },
      ability,
    );
    const damage = rows.find(([label]) => label.toLowerCase().includes("damage"))?.[1] ?? "";
    expect(damage).toContain("1d8");
    expect(damage).toContain("4d8");
    expect(damage).not.toContain("MOD");
  });

  it("gives the saving throw, what happens on a success and the area", () => {
    const rows = spellFacts(
      {
        damage: [{ damageType: { index: "fire" }, damageAtSlotLevel: { "3": "8d6" } }],
        dc: { dcType: { index: "dex" }, dcSuccess: "half" },
        areaOfEffect: { type: "sphere", size: 20 },
      },
      ability,
    );
    const text = rows.map(([label, value]) => `${label}: ${value}`).join("\n");
    expect(text).toContain("8d6");
    expect(text).toContain("DEX");
    expect(text.toLowerCase()).toContain("half");
    expect(text.toLowerCase()).toContain("sphere");
  });

  it("has no rows for a spell that does nothing of the sort", () => {
    expect(spellFacts({}, ability)).toEqual([]);
  });
});
