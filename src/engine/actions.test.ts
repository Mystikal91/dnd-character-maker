import { describe, expect, it } from "vitest";
import { srd51Index as index } from "../test/srd51";
import { activationOf, breathWeaponOf, characterActions } from "./actions";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

function hero(
  classId: string,
  level: number,
  extra: (c: ReturnType<typeof createCharacter>) => void = () => {},
) {
  const c = createCharacter("srd51");
  c.classes = [{ classId: `srd51:class/${classId}`, level }];
  c.abilityBase = { str: 14, dex: 14, con: 14, int: 10, wis: 14, cha: 10 };
  extra(c);
  return deriveSheet(c, index);
}

describe("the actions of a character", () => {
  it("sorts what a monk can do into action, bonus action and reaction", () => {
    const sheet = hero("monk", 5);
    const found = characterActions(sheet, index);
    expect(found.bonus).toEqual(
      expect.arrayContaining([
        "srd51:feature/martial-arts",
        "srd51:feature/flurry-of-blows",
        "srd51:feature/patient-defense",
        "srd51:feature/step-of-the-wind",
      ]),
    );
    expect(found.reaction).toContain("srd51:feature/deflect-missiles");
    expect(found.action).not.toContain("srd51:feature/flurry-of-blows");
    // Stunning Strike is not an action of its own: it comes with a hit.
    expect(Object.values(found).flat()).not.toContain("srd51:feature/stunning-strike");
  });

  it("leaves out what the person hid and what has a panel of its own", () => {
    const barbarian = characterActions(hero("barbarian", 3), index);
    expect(Object.values(barbarian).flat()).not.toContain("srd51:feature/rage");
    const rogue = hero("rogue", 5);
    expect(characterActions(rogue, index).bonus).toContain("srd51:feature/cunning-action");
    const hidden = { ...rogue, hiddenFeatures: ["srd51:feature/cunning-action"] };
    expect(characterActions(hidden, index).bonus).not.toContain("srd51:feature/cunning-action");
  });

  it("reads the activation from the entry", () => {
    expect(activationOf(index.get("srd51:feature/uncanny-dodge"))).toBe("reaction");
    expect(activationOf(index.get("srd51:feature/sneak-attack"))).toBeUndefined();
    expect(activationOf(undefined)).toBeUndefined();
  });
});

describe("the breath weapon", () => {
  const dragonborn = (level: number) =>
    hero("fighter", level, (c) => {
      c.choices.species = "srd51:species/dragonborn";
      c.selections["srd51:trait/draconic-ancestry/draconic-ancestry-subtrait"] = [
        "srd51:trait/draconic-ancestry-red",
      ];
    });

  it("is 2d6 of fire in a 15-foot cone at the first level, with a DC of 8 + proficiency + Con", () => {
    const sheet = dragonborn(1);
    const breath = breathWeaponOf(sheet, index);
    expect(breath).toMatchObject({
      dice: "2d6",
      damageType: "fire",
      save: "dex",
      half: true,
      area: { type: "cone", size: 15 },
    });
    expect(breath?.dc).toBe(8 + sheet.proficiencyBonus + sheet.abilities.con.modifier);
  });

  it("grows at the levels of the character", () => {
    expect(breathWeaponOf(dragonborn(5), index)?.dice).toBe("2d6");
    expect(breathWeaponOf(dragonborn(6), index)?.dice).toBe("3d6");
    expect(breathWeaponOf(dragonborn(11), index)?.dice).toBe("4d6");
    expect(breathWeaponOf(dragonborn(16), index)?.dice).toBe("5d6");
  });

  it("is nothing for a character without it", () => {
    expect(breathWeaponOf(hero("fighter", 3), index)).toBeUndefined();
  });
});
