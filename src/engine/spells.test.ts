import { describe, expect, it } from "vitest";
import { srd51Index as index } from "../test/srd51";
import { type Character, createCharacter } from "./character";
import { deriveSheet } from "./derive";

function caster(classId: string, level: number, abilities: Partial<Character["abilityBase"]> = {}) {
  const c = createCharacter("srd51");
  c.classes = [{ classId: `srd51:class/${classId}`, level }];
  c.abilityBase = { ...c.abilityBase, ...abilities };
  return c;
}
const spell = (slug: string) => `srd51:spell/${slug}`;
const lists = (c: Character) => deriveSheet(c, index).spellcasting?.lists;

describe("wizard (spellbook)", () => {
  it("has a spellbook of 6 at level 1 plus 2 per level, and prepares INT mod + level", () => {
    const l1 = lists(caster("wizard", 1, { int: 16 }));
    expect(l1?.preparation).toBe("spellbook");
    expect(l1?.cantrips?.allowed).toBe(3);
    expect(l1?.known?.allowed).toBe(6);
    expect(l1?.prepared?.allowed).toBe(4); // +3 INT, level 1
    const l5 = lists(caster("wizard", 5, { int: 16 }));
    expect(l5?.known?.allowed).toBe(14);
    expect(l5?.prepared?.allowed).toBe(8);
    expect(l5?.maxSpellLevel).toBe(3);
  });

  it("limits the pool to the wizard list and to spell levels the class can cast", () => {
    const l = lists(caster("wizard", 1));
    expect(l?.known?.pool).toContain(spell("magic-missile"));
    expect(l?.known?.pool).not.toContain(spell("fireball")); // level 3
    expect(l?.known?.pool).not.toContain(spell("cure-wounds")); // not a wizard spell
    expect(l?.cantrips?.pool).toContain(spell("fire-bolt"));
    expect(l?.cantrips?.pool).not.toContain(spell("magic-missile"));
  });

  it("prepares only from the spellbook", () => {
    const c = caster("wizard", 1, { int: 16 });
    c.spells[c.classes[0]?.classId ?? ""] = {
      cantrips: [spell("fire-bolt")],
      known: [spell("magic-missile"), spell("shield")],
      prepared: [spell("shield")],
    };
    const l = lists(c);
    expect(l?.prepared?.pool).toEqual([spell("magic-missile"), spell("shield")]);
    expect(l?.prepared?.chosen).toEqual([spell("shield")]);
  });
});

describe("known casters", () => {
  it("gives a sorcerer cantrips and spells known from the class table", () => {
    const l = lists(caster("sorcerer", 1));
    expect(l?.preparation).toBe("known");
    expect(l?.cantrips?.allowed).toBe(4);
    expect(l?.known?.allowed).toBe(2);
    expect(l?.prepared).toBeUndefined();
  });

  it("limits a warlock to the level of its pact slots", () => {
    const l = lists(caster("warlock", 3));
    expect(l?.maxSpellLevel).toBe(2);
    expect(l?.known?.allowed).toBe(4);
    expect(l?.known?.pool).not.toContain(spell("fireball"));
  });

  it("gives a ranger no cantrips and no spells before level 2", () => {
    expect(lists(caster("ranger", 1))).toBeUndefined();
    const l = lists(caster("ranger", 2));
    expect(l?.cantrips).toBeUndefined();
    expect(l?.known?.allowed).toBe(2);
  });
});

describe("prepared casters", () => {
  it("lets a cleric prepare WIS mod + level from the whole class list", () => {
    const l = lists(caster("cleric", 3, { wis: 16 }));
    expect(l?.preparation).toBe("prepared");
    expect(l?.prepared?.allowed).toBe(6);
    expect(l?.known).toBeUndefined();
    expect(l?.prepared?.pool).toContain(spell("cure-wounds"));
  });

  it("prepares at least one spell", () => {
    expect(lists(caster("cleric", 1, { wis: 6 }))?.prepared?.allowed).toBe(1);
  });

  it("halves the level for a paladin, who starts casting at level 2", () => {
    expect(lists(caster("paladin", 1))).toBeUndefined();
    expect(lists(caster("paladin", 5, { cha: 14 }))?.prepared?.allowed).toBe(4); // +2 + floor(5/2)
  });

  it("keeps subclass spells out of the pool and does not count them", () => {
    const c = caster("cleric", 3, { wis: 14 });
    c.classes = [{ classId: "srd51:class/cleric", level: 3, subclassId: "srd51:subclass/life" }];
    const l = lists(c);
    expect(l?.alwaysPrepared).toContain(spell("bless"));
    expect(l?.prepared?.pool).not.toContain(spell("bless"));
    expect(l?.prepared?.allowed).toBe(5);
  });
});

describe("validation", () => {
  it("ignores and reports invalid and surplus picks", () => {
    const c = caster("sorcerer", 1);
    c.spells["srd51:class/sorcerer"] = {
      cantrips: [
        spell("fire-bolt"),
        spell("magic-missile"),
        spell("light"),
        spell("mage-hand"),
        spell("shocking-grasp"),
        spell("ray-of-frost"),
      ],
      known: [spell("shield"), spell("cure-wounds")],
      prepared: [],
    };
    const sheet = deriveSheet(c, index);
    const l = sheet.spellcasting?.lists;
    expect(l?.cantrips?.chosen).toHaveLength(4);
    expect(l?.known?.chosen).toEqual([spell("shield")]);
    expect(sheet.warnings).toEqual(
      expect.arrayContaining([
        {
          code: "invalidSpell",
          params: { spell: spell("magic-missile"), class: "srd51:class/sorcerer" },
        },
        {
          code: "invalidSpell",
          params: { spell: spell("cure-wounds"), class: "srd51:class/sorcerer" },
        },
        { code: "tooManySpells", params: { class: "srd51:class/sorcerer" } },
      ]),
    );
  });
});
