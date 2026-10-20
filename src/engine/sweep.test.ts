import { describe, expect, it } from "vitest";
import { classData } from "../data/progression";
import { CLASSES, LEVELS, SPECIES, build, complete } from "../test/characters";
import { srd51Index as index } from "../test/srd51";
import { parseCharacter } from "./characterSchema";
import { deriveSheet } from "./derive";
import { applyLevelUp, averageHp } from "./levelUp";

/** Warnings that are fine for a character filled in by taking the first options. */
const EXPECTED = new Set([
  "notProficient",
  "strengthMinimum",
  "optionLevel",
  "optionFeature",
  "expertiseNeedsProficiency",
]);

describe("every class, level and species", () => {
  it("derives a sound sheet with no unexpected warnings", () => {
    const problems: string[] = [];
    for (const cls of CLASSES) {
      for (const level of LEVELS) {
        for (const species of SPECIES) {
          const c = complete(build(cls, level, species));
          const label = `${cls} ${level} ${species}`;
          let sheet: ReturnType<typeof deriveSheet>;
          try {
            sheet = deriveSheet(c, index);
          } catch (error) {
            problems.push(`${label}: threw ${String(error)}`);
            continue;
          }
          const bad = sheet.warnings.filter((w) => !EXPECTED.has(w.code));
          if (bad.length > 0) problems.push(`${label}: ${JSON.stringify(bad.slice(0, 2))}`);

          const numbers: [string, number | undefined][] = [
            ["ac", sheet.armorClass.value],
            ["hp", sheet.hitPoints.max],
            ["speed", sheet.speed],
            ["initiative", sheet.initiative],
            ["passive", sheet.passivePerception],
            ["prof", sheet.proficiencyBonus],
            ...sheet.skills.map((s): [string, number] => [s.id, s.bonus]),
            ...sheet.attacks.map((a): [string, number] => ["attack", a.attackBonus]),
          ];
          for (const [name, value] of numbers)
            if (value === undefined || !Number.isFinite(value))
              problems.push(`${label}: ${name} is ${value}`);

          if (sheet.proficiencyBonus !== Math.ceil(level / 4) + 1)
            problems.push(`${label}: proficiency ${sheet.proficiencyBonus}`);
          const dice = Object.values(sheet.hitPoints.hitDice).reduce((a, b) => a + b, 0);
          if (dice !== level) problems.push(`${label}: ${dice} hit dice`);
          if (sheet.hitPoints.max < level) problems.push(`${label}: hp ${sheet.hitPoints.max}`);
          const open = sheet.choices.filter((ch) => ch.remaining > 0).map((ch) => ch.key);
          if (open.length > 0) problems.push(`${label}: open choices ${open.join(", ")}`);
          for (const caster of sheet.spellcasters) {
            const lists = [caster.lists.cantrips, caster.lists.known, caster.lists.prepared];
            for (const pick of lists)
              if (pick && pick.chosen.length < pick.allowed && pick.pool.length >= pick.allowed)
                problems.push(
                  `${label}: ${caster.classId} picks ${pick.chosen.length}/${pick.allowed}`,
                );
            if (caster.spellSlots.length !== 9 || caster.spellSlots.some((n) => n < 0))
              problems.push(`${label}: slots ${caster.spellSlots}`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

describe("known values of the rules", () => {
  const sheet = (cls: string, level: number) =>
    deriveSheet(complete(build(cls, level, "human")), index);

  it("matches the hit points formula", () => {
    // Fighter: d10, Constitution 13 (+1), human +1 to every score: 14 (+2).
    const fighter = sheet("fighter", 20);
    expect(fighter.hitPoints.max).toBe(10 + 2 + 19 * (6 + 2));
    const wizard = sheet("wizard", 5);
    expect(wizard.hitPoints.max).toBe(6 + 2 + 4 * (4 + 2));
  });

  it("matches the spell slot tables", () => {
    expect(sheet("wizard", 1).spellSlots).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(sheet("wizard", 5).spellSlots).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0]);
    expect(sheet("cleric", 9).spellSlots).toEqual([4, 3, 3, 3, 1, 0, 0, 0, 0]);
    expect(sheet("sorcerer", 20).spellSlots).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
    expect(sheet("paladin", 1).spellSlots).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(sheet("paladin", 2).spellSlots).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(sheet("paladin", 5).spellSlots).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0]);
    expect(sheet("ranger", 9).spellSlots).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0]);
    expect(sheet("warlock", 5).spellSlots).toEqual([0, 0, 2, 0, 0, 0, 0, 0, 0]);
    expect(sheet("warlock", 11).spellSlots).toEqual([0, 0, 0, 0, 3, 0, 0, 0, 0]);
    expect(sheet("warlock", 17).spellSlots).toEqual([0, 0, 0, 0, 4, 0, 0, 0, 0]);
  });

  it("matches cantrips and spells known", () => {
    const cantrips = (cls: string, level: number) => sheet(cls, level).spellcasting?.cantripsKnown;
    expect(cantrips("wizard", 1)).toBe(3);
    expect(cantrips("wizard", 4)).toBe(4);
    expect(cantrips("wizard", 10)).toBe(5);
    expect(cantrips("sorcerer", 1)).toBe(4);
    expect(cantrips("sorcerer", 10)).toBe(6);
    expect(cantrips("warlock", 1)).toBe(2);
    expect(cantrips("warlock", 10)).toBe(4);
    expect(cantrips("druid", 4)).toBe(3);
    const known = (cls: string, level: number) => sheet(cls, level).spellcasting?.spellsKnown;
    expect(known("sorcerer", 1)).toBe(2);
    expect(known("sorcerer", 20)).toBe(15);
    expect(known("bard", 1)).toBe(4);
    expect(known("bard", 20)).toBe(22);
    expect(known("warlock", 2)).toBe(3);
    expect(known("warlock", 20)).toBe(15);
    expect(known("ranger", 2)).toBe(2);
    expect(known("ranger", 20)).toBe(11);
  });

  it("matches the saving throw DC and attack bonus of a caster", () => {
    const cleric = sheet("cleric", 5);
    // Wisdom 10 +1 (human) = 11 (+0), proficiency +3.
    expect(cleric.spellcasting?.saveDc).toBe(8 + 3 + 0);
    expect(cleric.spellcasting?.attackBonus).toBe(3);
  });

  it("matches the ability score improvements of each class", () => {
    const asi = (cls: string, level: number) => sheet(cls, level).asi.available;
    expect(asi("wizard", 3)).toBe(0);
    expect(asi("wizard", 4)).toBe(1);
    expect(asi("wizard", 19)).toBe(5);
    expect(asi("fighter", 19)).toBe(7);
    expect(asi("rogue", 19)).toBe(6);
    expect(asi("rogue", 10)).toBe(3);
    expect(asi("rogue", 12)).toBe(4);
  });
});

describe("level up", () => {
  it("reaches the same sheet as building the character at that level, for every class", () => {
    const problems: string[] = [];
    for (const cls of CLASSES) {
      let c = build(cls, 1, "human", false);
      c.classes = [{ classId: `srd51:class/${cls}`, level: 1 }];
      for (let level = 2; level <= 20; level++) {
        const sheet = deriveSheet(c, index);
        c = applyLevelUp(c, `srd51:class/${cls}`, { type: "average" }, index);
        const direct = build(cls, level, "human", false);
        direct.classes = [{ classId: `srd51:class/${cls}`, level }];
        const a = deriveSheet(c, index);
        const b = deriveSheet(direct, index);
        if (a.hitPoints.max !== b.hitPoints.max)
          problems.push(`${cls} ${level}: hp ${a.hitPoints.max} vs ${b.hitPoints.max}`);
        if (a.level !== level) problems.push(`${cls}: level ${a.level} at ${level}`);
        if (JSON.stringify(a.spellSlots) !== JSON.stringify(b.spellSlots))
          problems.push(`${cls} ${level}: slots differ`);
        if (a.level - sheet.level !== 1) problems.push(`${cls} ${level}: skipped a level`);
      }
    }
    expect(problems).toEqual([]);
    expect(averageHp(8)).toBe(5);
  });
});

describe("multiclass", () => {
  it("combines caster levels and keeps Pact Magic apart", () => {
    const pairs: string[] = [];
    for (const first of CLASSES) {
      for (const second of CLASSES) {
        if (first === second) continue;
        const c = complete(build(first, 5, "human", false));
        c.abilityBase = { str: 16, dex: 16, con: 14, int: 16, wis: 16, cha: 16 };
        c.classes = [
          { classId: `srd51:class/${first}`, level: 5 },
          { classId: `srd51:class/${second}`, level: 4 },
        ];
        const sheet = complete(c) && deriveSheet(c, index);
        if (sheet.level !== 9) pairs.push(`${first}+${second}: level ${sheet.level}`);
        if (!Number.isFinite(sheet.hitPoints.max) || sheet.hitPoints.max < 9)
          pairs.push(`${first}+${second}: hp ${sheet.hitPoints.max}`);
        const unexpected = sheet.warnings.filter((w) => !EXPECTED.has(w.code));
        if (unexpected.length > 0)
          pairs.push(`${first}+${second}: ${JSON.stringify(unexpected.slice(0, 2))}`);
        // Only the warlock has Pact Magic apart from the shared slots.
        const warlocks = [first, second].filter((x) => x === "warlock").length;
        const casters = [first, second].filter(
          (x) => x !== "warlock" && classData(index.get(`srd51:class/${x}`) as never).spellcasting,
        );
        if (warlocks === 1 && casters.length === 1 && !sheet.pactSlots)
          pairs.push(`${first}+${second}: no pact slots`);
      }
    }
    expect(pairs).toEqual([]);
  });
});

describe("saving and opening", () => {
  it("keeps a character the same through its own file format", () => {
    for (const cls of CLASSES) {
      const c = complete(build(cls, 7, "elf"));
      const back = parseCharacter(JSON.parse(JSON.stringify(c)));
      expect(back).toEqual(c);
      expect(JSON.stringify(deriveSheet(back, index))).toBe(JSON.stringify(deriveSheet(c, index)));
    }
  });
});
