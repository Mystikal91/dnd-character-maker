import { describe, expect, it } from "vitest";
import { srd51Index as index } from "../test/srd51";
import { type Character, createCharacter } from "./character";
import { deriveSheet } from "./derive";

const STYLE = "srd51:feature/fighter-fighting-style/option";

function fighter(
  scores: Partial<Record<"str" | "dex", number>>,
  weapons: [string, "mainHand" | "offHand" | undefined][],
): Character {
  const c = createCharacter("srd51");
  c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
  c.abilityBase = { str: 16, dex: 14, con: 12, int: 10, wis: 10, cha: 10, ...scores };
  c.inventory = weapons.map(([name, slot]) => ({
    itemId: `srd51:item/${name}`,
    quantity: 1,
    equipped: true,
    ...(slot && { slot }),
  }));
  return c;
}

const damageOf = (c: Character, name: string) =>
  deriveSheet(c, index).attacks.find((a) => a.itemId.endsWith(`/${name}`));

describe("a weapon in the off hand", () => {
  it("does not add the ability modifier to damage, and the main hand does", () => {
    const c = fighter({ str: 16 }, [
      ["longsword", "mainHand"],
      ["shortsword", "offHand"],
    ]);
    expect(damageOf(c, "longsword")?.damage?.bonus).toBe(3);
    const off = damageOf(c, "shortsword");
    expect(off?.damage?.bonus).toBe(0);
    expect(off?.offHand).toBe(true);
    // The attack roll still has it.
    expect(off?.attackBonus).toBe(3 + 2);
  });

  it("keeps it with the fighting style Two-Weapon Fighting", () => {
    const c = fighter({ str: 16 }, [
      ["longsword", "mainHand"],
      ["shortsword", "offHand"],
    ]);
    c.selections[STYLE] = ["srd51:feature/fighter-fighting-style-two-weapon-fighting"];
    const off = damageOf(c, "shortsword");
    expect(off?.damage?.bonus).toBe(3);
    expect(off?.offHand).toBeUndefined();
  });

  it("still takes off a negative modifier", () => {
    // A handaxe has no finesse: Strength 6 is -2, and it stays.
    const c = fighter({ str: 6 }, [
      ["longsword", "mainHand"],
      ["handaxe", "offHand"],
    ]);
    expect(damageOf(c, "handaxe")?.damage?.bonus).toBe(-2);
  });

  it("uses the modifier of the ability the weapon is attacked with", () => {
    const c = fighter({ str: 10, dex: 18 }, [
      ["dagger", "mainHand"],
      ["shortsword", "offHand"],
    ]);
    // A finesse weapon in the off hand: Dexterity is what it would add, and it is left out.
    expect(damageOf(c, "dagger")?.damage?.bonus).toBe(4);
    expect(damageOf(c, "shortsword")?.damage?.bonus).toBe(0);
  });

  it("is not a thing of a weapon held alone, nor of one in the main hand", () => {
    const alone = fighter({ str: 16 }, [["longsword", undefined]]);
    expect(damageOf(alone, "longsword")?.damage?.bonus).toBe(3);
    expect(damageOf(alone, "longsword")?.offHand).toBeUndefined();
    // A shield takes the off hand: the sword is still in the main one.
    const shielded = fighter({ str: 16 }, [
      ["longsword", undefined],
      ["shield", undefined],
    ]);
    expect(damageOf(shielded, "longsword")?.damage?.bonus).toBe(3);
  });
});
