import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { type Character, createCharacter } from "./character";
import { deriveSheet } from "./derive";
import { type SpellRollData, spellRolls } from "./spellRolls";

const INVOCATIONS = "srd51:feature/eldritch-invocations/option";
const PACT = "srd51:feature/pact-boon/option";
const TOME_CANTRIPS = "srd51:feature/pact-of-the-tome/cantrip";
const invocation = (name: string) => `srd51:feature/eldritch-invocation-${name}`;
const spell = (slug: string) => `srd51:spell/${slug}`;

function warlock(level: number, cha = 16): Character {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/human";
  c.classes = [{ classId: "srd51:class/warlock", level }];
  c.abilityBase = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha };
  return c;
}

describe("spells an invocation lets the warlock cast at will", () => {
  it("lists them as granted and at will, so they are treated as cantrips", () => {
    const c = warlock(9);
    c.selections[INVOCATIONS] = [
      invocation("armor-of-shadows"),
      invocation("ascendant-step"),
      invocation("chains-of-carceri"),
    ];
    const sheet = deriveSheet(c, srd51Index);
    for (const slug of ["mage-armor", "levitate", "hold-monster"]) {
      expect(sheet.grantedSpells).toContain(spell(slug));
      expect(sheet.atWillSpells).toContain(spell(slug));
    }
  });

  it("counts Chains of Carceri at will, with no counter of uses", () => {
    const c = warlock(15);
    c.selections[INVOCATIONS] = [invocation("chains-of-carceri")];
    const sheet = deriveSheet(c, srd51Index);
    expect(sheet.atWillSpells).toContain(spell("hold-monster"));
    expect(sheet.resources.some((r) => r.entry === invocation("chains-of-carceri"))).toBe(false);
  });

  it("leaves the spells cast once with a slot as they were", () => {
    const c = warlock(9);
    c.selections[INVOCATIONS] = [invocation("minions-of-chaos")];
    const sheet = deriveSheet(c, srd51Index);
    expect(sheet.grantedSpells).toContain(spell("conjure-elemental"));
    expect(sheet.atWillSpells).not.toContain(spell("conjure-elemental"));
    expect(sheet.resources.some((r) => r.entry === invocation("minions-of-chaos"))).toBe(true);
  });
});

describe("Agonizing Blast", () => {
  it("adds the Charisma modifier to the damage of Eldritch Blast, and only with the invocation", () => {
    const c = warlock(2, 16);
    expect(deriveSheet(c, srd51Index).spellDamage).toEqual([]);
    c.selections[INVOCATIONS] = [invocation("agonizing-blast")];
    expect(deriveSheet(c, srd51Index).spellDamage).toEqual([
      { value: 3, spell: spell("eldritch-blast"), once: false },
    ]);
    c.abilityBase.cha = 8;
    expect(deriveSheet(c, srd51Index).spellDamage[0]?.value).toBe(-1);
  });

  it("is written into the dice the spell rolls", () => {
    const data = srd51Index.get(spell("eldritch-blast"))?.data as SpellRollData;
    const id = spell("eldritch-blast");
    const base = { slotLevel: 0, characterLevel: 5, modifier: 3, spellId: id };
    const plus = (value: number) => [{ value, spell: id, once: false }];
    expect(spellRolls(data, base).damage).toEqual([{ type: "force", dice: "1d10" }]);
    expect(spellRolls(data, { ...base, bonuses: plus(3) }).damage).toEqual([
      { type: "force", dice: "1d10+3" },
    ]);
    expect(spellRolls(data, { ...base, bonuses: plus(-1) }).damage[0]?.dice).toBe("1d10-1");
  });
});

describe("the cantrips of the Pact of the Tome", () => {
  const withTome = (level = 3) => {
    const c = warlock(level);
    c.selections[PACT] = ["srd51:feature/pact-of-the-tome"];
    return c;
  };
  const choice = (c: Character) =>
    deriveSheet(c, srd51Index).choices.find((x) => x.key === TOME_CANTRIPS);

  it("offers three cantrips from every list, and nothing without the pact", () => {
    expect(choice(warlock(3))).toBeUndefined();
    const found = choice(withTome());
    expect(found?.choose).toBe(3);
    expect(found?.remaining).toBe(3);
    const cantrips = [...srd51Index.values()].filter(
      (e) => e.kind === "spell" && e.data.level === 0,
    );
    expect(found?.options).toHaveLength(cantrips.length);
    // From the lists of other classes too, not only the warlock's.
    expect(found?.options).toContain(spell("eldritch-blast"));
    expect(found?.options).toContain(spell("guidance"));
    expect(found?.options).not.toContain(spell("fireball"));
  });

  it("grants what is picked as spells of the character", () => {
    const c = withTome();
    c.selections[TOME_CANTRIPS] = [spell("guidance"), spell("light"), spell("mending")];
    const sheet = deriveSheet(c, srd51Index);
    expect(sheet.grantedSpells).toEqual(
      expect.arrayContaining([spell("guidance"), spell("light"), spell("mending")]),
    );
    expect(sheet.choices.find((x) => x.key === TOME_CANTRIPS)?.remaining).toBe(0);
  });
});

function at(level: number, classId: string, extra: Partial<Character> = {}): Character {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/human";
  c.classes = [{ classId: `srd51:class/${classId}`, level }];
  c.abilityBase = { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 16 };
  return Object.assign(c, extra);
}
const pick = (c: Character, key: string) =>
  deriveSheet(c, srd51Index).choices.find((x) => x.key === key);
const SPELL_DATA = (slug: string) => srd51Index.get(spell(slug))?.data as SpellRollData;

describe("the spell of the Mystic Arcanum", () => {
  const KEY = "srd51:feature/mystic-arcanum-6th-level/arcanum";

  it("offers the warlock spells of that level only, and gives the pick once between long rests", () => {
    const found = pick(at(11, "warlock"), KEY);
    expect(found?.choose).toBe(1);
    expect(found?.options.length).toBeGreaterThan(3);
    for (const id of found?.options ?? []) {
      const data = srd51Index.get(id)?.data as { level: number; classes: string[] };
      expect(data.level).toBe(6);
      expect(data.classes).toContain("srd51:class/warlock");
    }
    const c = at(11, "warlock");
    c.selections[KEY] = [spell("eyebite")];
    const sheet = deriveSheet(c, srd51Index);
    expect(sheet.grantedSpells).toContain(spell("eyebite"));
    const counter = sheet.resources.find((r) => r.spell === spell("eyebite"));
    expect(counter?.recovery).toBe("long");
    expect(pick(at(10, "warlock"), KEY)).toBeUndefined();
  });
});

describe("the wizard's Spell Mastery and Signature Spells", () => {
  it("casts the two spells of Spell Mastery at will, as cantrips", () => {
    const base = "srd51:feature/spell-mastery";
    const c = at(18, "wizard");
    expect(pick(c, `${base}/first`)?.options).toContain(spell("shield"));
    expect(pick(c, `${base}/second`)?.options).toContain(spell("misty-step"));
    c.selections[`${base}/first`] = [spell("shield")];
    c.selections[`${base}/second`] = [spell("misty-step")];
    const sheet = deriveSheet(c, srd51Index);
    expect(sheet.atWillSpells).toEqual(
      expect.arrayContaining([spell("shield"), spell("misty-step")]),
    );
  });

  it("gives the two Signature Spells a free cast each between short rests", () => {
    const key = "srd51:feature/signature-spell/signature";
    const c = at(20, "wizard");
    expect(pick(c, key)?.choose).toBe(2);
    c.selections[key] = [spell("counterspell"), spell("fireball")];
    const sheet = deriveSheet(c, srd51Index);
    const counters = sheet.resources.filter((r) => r.kind === "freeSpell");
    expect(counters.map((r) => r.spell).sort()).toEqual([spell("counterspell"), spell("fireball")]);
    expect(counters.every((r) => r.recovery === "short" && r.max === 1)).toBe(true);
    // The counter of the feature itself is gone: the two spells carry the uses.
    expect(
      sheet.resources.some(
        (r) => r.entry === "srd51:feature/signature-spell" && r.kind !== "freeSpell",
      ),
    ).toBe(false);
  });
});

describe("damage that a feature adds to spells", () => {
  const bonuses = (c: Character) => deriveSheet(c, srd51Index).spellDamage;
  const rolls = (slug: string, level: number, list: ReturnType<typeof bonuses>) =>
    spellRolls(SPELL_DATA(slug), {
      slotLevel: level,
      characterLevel: 10,
      modifier: 0,
      bonuses: list,
      spellId: spell(slug),
    }).damage;

  it("adds Intelligence to one roll of an evocation spell, with Empowered Evocation", () => {
    const c = at(10, "wizard");
    c.classes = [
      { classId: "srd51:class/wizard", level: 10, subclassId: "srd51:subclass/evocation" },
    ];
    const list = bonuses(c);
    expect(list).toEqual([{ value: 3, school: "evocation", once: true }]);
    expect(rolls("fireball", 3, list)[0]?.dice).toBe("8d6+3");
    // Ice Storm rolls two kinds of damage: the bonus is for one of them, the first.
    const ice = rolls("ice-storm", 4, list);
    expect(ice[0]?.dice).toMatch(/\+3$/);
    expect(ice[1]?.dice).not.toMatch(/\+3$/);
    // Not for another school.
    expect(rolls("cure-wounds", 1, list)).toEqual([]);
    expect(rolls("poison-spray", 0, list)[0]?.dice).not.toMatch(/\+/);
  });

  it("adds Charisma to the damage of the type of the dragon ancestor, with Elemental Affinity", () => {
    const c = at(6, "sorcerer");
    c.classes = [
      { classId: "srd51:class/sorcerer", level: 6, subclassId: "srd51:subclass/draconic" },
    ];
    c.selections["srd51:feature/dragon-ancestor/option"] = [
      "srd51:feature/dragon-ancestor-red---fire-damage",
    ];
    const list = bonuses(c);
    expect(list).toEqual([{ value: 3, damageType: "fire", once: true }]);
    expect(rolls("fireball", 3, list)[0]?.dice).toBe("8d6+3");
    expect(rolls("lightning-bolt", 3, list)[0]?.dice).toBe("8d6");
    c.selections["srd51:feature/dragon-ancestor/option"] = [
      "srd51:feature/dragon-ancestor-blue---lightning-damage",
    ];
    expect(bonuses(c)).toEqual([{ value: 3, damageType: "lightning", once: true }]);
  });

  it("gives nothing without the feature or before its level", () => {
    expect(bonuses(at(9, "wizard"))).toEqual([]);
    expect(bonuses(at(5, "sorcerer"))).toEqual([]);
  });
});

describe("spells picked from every list", () => {
  it("lets a bard pick two spells of any class up to the level the table allows, with Magical Secrets", () => {
    const key = "srd51:feature/magical-secrets-1/secrets";
    const found = pick(at(10, "bard"), key);
    expect(found?.choose).toBe(2);
    expect(found?.options).toContain(spell("fireball"));
    expect(found?.options).toContain(spell("guidance"));
    expect(found?.options).not.toContain(spell("disintegrate"));
    const c = at(10, "bard");
    c.selections[key] = [spell("fireball"), spell("guidance")];
    expect(deriveSheet(c, srd51Index).grantedSpells).toEqual(
      expect.arrayContaining([spell("fireball"), spell("guidance")]),
    );
  });

  it("lets a warlock with Book of Ancient Secrets pick two 1st-level rituals", () => {
    const key = "srd51:feature/eldritch-invocation-book-of-ancient-secrets/rituals";
    const c = at(3, "warlock");
    c.selections[PACT] = ["srd51:feature/pact-of-the-tome"];
    c.selections[INVOCATIONS] = [invocation("book-of-ancient-secrets")];
    const found = pick(c, key);
    expect(found?.choose).toBe(2);
    for (const id of found?.options ?? []) {
      const data = srd51Index.get(id)?.data as { level: number; ritual: boolean };
      expect(data.level).toBe(1);
      expect(data.ritual).toBe(true);
    }
    expect(found?.options).toContain(spell("detect-magic"));
  });
});
