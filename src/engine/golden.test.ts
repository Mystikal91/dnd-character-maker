import { describe, expect, it } from "vitest";
import type { Ability } from "../data/schema";
import { srd51Index as index } from "../test/srd51";
import { type Character, createCharacter } from "./character";
import { deriveSheet } from "./derive";

/**
 * Characters whose sheets were worked out by hand from the SRD 5.1 rules, one number at a time.
 * Nobody picks a species, so the scores here are the scores on the sheet. If the engine and the
 * book disagree, one of them is wrong: do not change a number here to make a test pass without
 * checking it against the rules.
 */
interface Golden {
  name: string;
  classes: { id: string; level: number }[];
  scores: Record<Ability, number>;
  items?: string[];
  expect: {
    level: number;
    proficiencyBonus: number;
    armorClass: number;
    hitPoints: number;
    initiative: number;
    saves?: Partial<Record<Ability, number>>;
    passivePerception?: number;
    spellSaveDc?: number;
    spellAttack?: number;
    spellSlots?: number[];
    attack?: { item: string; bonus: number; damage: string };
  };
}

const scores = (str: number, dex: number, con: number, int: number, wis: number, cha: number) => ({
  str,
  dex,
  con,
  int,
  wis,
  cha,
});

const CASES: Golden[] = [
  {
    // Chain mail 16 (no Dexterity), shield +2. 10 + Con 2 hit points. Longsword: Str 3 + proficiency 2.
    name: "fighter 1 in chain mail with a shield",
    classes: [{ id: "fighter", level: 1 }],
    scores: scores(16, 14, 14, 10, 12, 8),
    items: ["chain-mail", "shield", "longsword"],
    expect: {
      level: 1,
      proficiencyBonus: 2,
      armorClass: 18,
      hitPoints: 12,
      initiative: 2,
      saves: { str: 5, dex: 2, con: 4, wis: 1 },
      passivePerception: 11,
      attack: { item: "longsword", bonus: 5, damage: "1d8+3" },
    },
  },
  {
    // 6 + 2 at level 1, then four levels of 4 + 2. Unarmored 10 + Dex 2. DC 8 + 3 + Int 3.
    name: "wizard 5 without armor",
    classes: [{ id: "wizard", level: 5 }],
    scores: scores(8, 14, 14, 16, 10, 10),
    expect: {
      level: 5,
      proficiencyBonus: 3,
      armorClass: 12,
      hitPoints: 32,
      initiative: 2,
      saves: { int: 6, wis: 3, dex: 2, str: -1 },
      spellSaveDc: 14,
      spellAttack: 6,
      spellSlots: [4, 3, 2],
    },
  },
  {
    // Unarmored defense: 10 + Dex 2 + Con 3. 12 + 3, then two levels of 7 + 3.
    name: "barbarian 3 without armor",
    classes: [{ id: "barbarian", level: 3 }],
    scores: scores(16, 14, 16, 8, 10, 10),
    expect: {
      level: 3,
      proficiencyBonus: 2,
      armorClass: 15,
      hitPoints: 35,
      initiative: 2,
      saves: { str: 5, con: 5, dex: 2, wis: 0 },
    },
  },
  {
    // Unarmored defense: 10 + Dex 3 + Wis 3. 8 + 2, then three levels of 5 + 2.
    name: "monk 4 without armor",
    classes: [{ id: "monk", level: 4 }],
    scores: scores(8, 16, 14, 10, 16, 10),
    expect: {
      level: 4,
      proficiencyBonus: 2,
      armorClass: 16,
      hitPoints: 31,
      initiative: 3,
      saves: { str: 1, dex: 5, con: 2, wis: 3 },
    },
  },
  {
    // Chain mail 16 and a shield. 10 + 1, then 6 + 1. Spells from level 2: DC 8 + 2 + Cha 2.
    name: "paladin 2 in chain mail with a shield",
    classes: [{ id: "paladin", level: 2 }],
    scores: scores(16, 10, 12, 10, 10, 14),
    items: ["chain-mail", "shield"],
    expect: {
      level: 2,
      proficiencyBonus: 2,
      armorClass: 18,
      hitPoints: 18,
      initiative: 0,
      saves: { wis: 2, cha: 4, str: 3 },
      spellSaveDc: 12,
      spellSlots: [2],
    },
  },
  {
    // Leather 11 + Dex 3. 8 + 2, then four levels of 5 + 2. Rapier: finesse, Dex 3 + proficiency 3.
    name: "rogue 5 in leather armor",
    classes: [{ id: "rogue", level: 5 }],
    scores: scores(8, 16, 14, 12, 10, 10),
    items: ["leather-armor", "rapier"],
    expect: {
      level: 5,
      proficiencyBonus: 3,
      armorClass: 14,
      hitPoints: 38,
      initiative: 3,
      saves: { dex: 6, int: 4, str: -1 },
      attack: { item: "rapier", bonus: 6, damage: "1d8+3" },
    },
  },
  {
    // Scale mail 14 + Dex (at most 2) 0, shield +2. 8 + 2, then two levels of 5 + 2. DC 8 + 2 + Wis 3.
    name: "cleric 3 in scale mail with a shield",
    classes: [{ id: "cleric", level: 3 }],
    scores: scores(10, 10, 14, 10, 16, 14),
    items: ["scale-mail", "shield"],
    expect: {
      level: 3,
      proficiencyBonus: 2,
      armorClass: 16,
      hitPoints: 24,
      initiative: 0,
      saves: { wis: 5, cha: 4, int: 0 },
      spellSaveDc: 13,
      spellAttack: 5,
      spellSlots: [4, 2],
    },
  },
  {
    // Fighter 10 + 2, 6 + 2; wizard three levels of 4 + 2. Level 5: proficiency 3. Only the wizard casts.
    name: "fighter 2 and wizard 3",
    classes: [
      { id: "fighter", level: 2 },
      { id: "wizard", level: 3 },
    ],
    scores: scores(16, 12, 14, 14, 10, 8),
    expect: {
      level: 5,
      proficiencyBonus: 3,
      armorClass: 11,
      hitPoints: 38,
      initiative: 1,
      spellSaveDc: 13,
      spellSlots: [4, 2],
    },
  },
  {
    // Pact Magic: two slots of level 2 at level 3. DC 8 + 2 + Cha 3.
    name: "warlock 3",
    classes: [{ id: "warlock", level: 3 }],
    scores: scores(8, 14, 14, 10, 10, 16),
    expect: {
      level: 3,
      proficiencyBonus: 2,
      armorClass: 12,
      hitPoints: 8 + 2 + 2 * (5 + 2),
      initiative: 2,
      saves: { wis: 2, cha: 5 },
      spellSaveDc: 13,
      spellAttack: 5,
    },
  },
];

function characterOf(golden: Golden): Character {
  const c = createCharacter("srd51");
  c.classes = golden.classes.map((cl) => ({ classId: `srd51:class/${cl.id}`, level: cl.level }));
  c.abilityBase = { ...golden.scores };
  c.inventory = (golden.items ?? []).map((item) => ({
    itemId: `srd51:item/${item}`,
    quantity: 1,
    equipped: true,
  }));
  return c;
}

describe("sheets worked out by hand", () => {
  for (const golden of CASES) {
    it(golden.name, () => {
      const sheet = deriveSheet(characterOf(golden), index);
      const want = golden.expect;
      expect(sheet.level, "level").toBe(want.level);
      expect(sheet.proficiencyBonus, "proficiency bonus").toBe(want.proficiencyBonus);
      expect(sheet.armorClass.value, "armor class").toBe(want.armorClass);
      expect(sheet.hitPoints.max, "hit points").toBe(want.hitPoints);
      expect(sheet.initiative, "initiative").toBe(want.initiative);
      for (const [ability, bonus] of Object.entries(want.saves ?? {}))
        expect(sheet.saves[ability as Ability].bonus, `${ability} save`).toBe(bonus);
      if (want.passivePerception !== undefined)
        expect(sheet.passivePerception, "passive perception").toBe(want.passivePerception);
      if (want.spellSaveDc !== undefined)
        expect(sheet.spellcasting?.saveDc, "spell save DC").toBe(want.spellSaveDc);
      if (want.spellAttack !== undefined)
        expect(sheet.spellcasting?.attackBonus, "spell attack").toBe(want.spellAttack);
      if (want.spellSlots)
        expect(sheet.spellSlots.slice(0, want.spellSlots.length), "spell slots").toEqual(
          want.spellSlots,
        );
      if (want.attack) {
        const attack = sheet.attacks.find((a) => a.itemId === `srd51:item/${want.attack?.item}`);
        expect(attack?.attackBonus, "attack bonus").toBe(want.attack.bonus);
        const dmg = attack?.damage;
        const bonus = dmg?.bonus ?? 0;
        expect(`${dmg?.dice}${bonus === 0 ? "" : bonus > 0 ? `+${bonus}` : bonus}`, "damage").toBe(
          want.attack.damage,
        );
      }
    });
  }

  it("gives a warlock two slots of level 2 that come back on a short rest", () => {
    const sheet = deriveSheet(characterOf(CASES[8] as Golden), index);
    expect(sheet.spellcasting?.pact).toBe(true);
    expect(sheet.spellcasting?.spellSlots.slice(0, 2)).toEqual([0, 2]);
  });
});
