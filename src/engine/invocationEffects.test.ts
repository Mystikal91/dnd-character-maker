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
    expect(deriveSheet(c, srd51Index).spellDamage[spell("eldritch-blast")]).toBeUndefined();
    c.selections[INVOCATIONS] = [invocation("agonizing-blast")];
    expect(deriveSheet(c, srd51Index).spellDamage[spell("eldritch-blast")]).toBe(3);
    c.abilityBase.cha = 8;
    expect(deriveSheet(c, srd51Index).spellDamage[spell("eldritch-blast")]).toBe(-1);
  });

  it("is written into the dice the spell rolls", () => {
    const data = srd51Index.get(spell("eldritch-blast"))?.data as SpellRollData;
    const base = { slotLevel: 0, characterLevel: 5, modifier: 3 };
    expect(spellRolls(data, base).damage).toEqual([{ type: "force", dice: "1d10" }]);
    expect(spellRolls(data, { ...base, bonus: 3 }).damage).toEqual([
      { type: "force", dice: "1d10+3" },
    ]);
    expect(spellRolls(data, { ...base, bonus: -1 }).damage[0]?.dice).toBe("1d10-1");
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
