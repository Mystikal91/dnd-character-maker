// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { loadSrd51Strings, srd51Index } from "../../test/srd51";
import {
  parseAction,
  parseArmorClass,
  parseBonuses,
  parseChallenge,
  parseHitPointScale,
  parseHitPoints,
  parseScaledBonuses,
  parseScaledPassive,
  parseSenses,
  parseSpeed,
} from "./companions";
import { type AuroraResult, parseAurora } from "./index";

// Invented creatures in the shape of an Aurora file; nothing here comes from a real book.
const wrap = (body: string) =>
  `<?xml version="1.0" encoding="utf-8" ?><elements><info><name>Beasts</name></info>${body}</elements>`;

const FILE = wrap(`
  <element name="Test Hawk" type="Companion" source="Test Book" id="ID_T_COMPANION_HAWK">
    <supports>Familiar, Variant Familiar</supports>
    <description><p>A small hunter of the sky.</p></description>
    <setters>
      <set name="size">Tiny</set>
      <set name="type">Beast</set>
      <set name="alignment">unaligned</set>
      <set name="ac">13 (natural armor)</set>
      <set name="hp">1 (1d4 - 1)</set>
      <set name="speed">10 ft., fly 60 ft.</set>
      <set name="strength">5</set>
      <set name="dexterity">16</set>
      <set name="constitution">8</set>
      <set name="intelligence">2</set>
      <set name="wisdom">14</set>
      <set name="charisma">6</set>
      <set name="skills">Perception +4</set>
      <set name="senses">passive Perception 14</set>
      <set name="languages">—</set>
      <set name="challenge">0</set>
      <set name="traits">ID_T_TRAIT_SIGHT</set>
      <set name="actions">ID_T_ACTION_TALONS, ID_T_ACTION_SCREECH</set>
    </setters>
  </element>
  <element name="Keen Sight" type="Companion Trait" source="Test Book" id="ID_T_TRAIT_SIGHT">
    <description><p>The hawk has advantage on sight checks.</p></description>
  </element>
  <element name="Talons" type="Companion Action" source="Test Book" id="ID_T_ACTION_TALONS">
    <description><p>Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 1 slashing damage.</p></description>
  </element>
  <element name="Screech" type="Companion Action" source="Test Book" id="ID_T_ACTION_SCREECH">
    <description><p>Each creature within 10 ft. must make a DC 11 Wisdom saving throw or take 2 (1d4) thunder damage.</p></description>
  </element>
  <element name="Test Beast of the Land" type="Companion" source="Test Book" id="ID_T_COMPANION_BEAST">
    <supports>Primeval Companion</supports>
    <description />
    <setters>
      <set name="size">Medium</set>
      <set name="type">Beast</set>
      <set name="alignment">unaligned</set>
      <set name="ac">13 + PB (natural armor)</set>
      <set name="hp">equal to five times your ranger level</set>
      <set name="speed">40 ft., climb 40 ft.</set>
      <set name="strength">14</set>
      <set name="dexterity">14</set>
      <set name="constitution">15</set>
      <set name="intelligence">8</set>
      <set name="wisdom">14</set>
      <set name="charisma">11</set>
      <set name="skills">Perception +2 plus PB, Stealth +2 plus PB</set>
      <set name="saves">Dex +2 plus PB</set>
      <set name="senses">darkvision 60 ft., passive Perception 12 plus PB x 2</set>
      <set name="challenge">—</set>
      <set name="actions">ID_T_ACTION_MAUL</set>
    </setters>
    <rules>
      <stat name="companion:ac" value="13" />
      <grant type="Companion Trait" id="ID_T_TRAIT_SIGHT" />
    </rules>
  </element>
  <element name="Maul" type="Companion Action" source="Test Book" id="ID_T_ACTION_MAUL">
    <description><p>Melee Weapon Attack: your spell attack modifier to hit. Hit: 1d8 + PB piercing damage.</p></description>
  </element>
  <element name="Wolf" type="Companion" source="Test Book" id="ID_T_COMPANION_WOLF">
    <description />
    <setters><set name="size">Medium</set><set name="type">Beast</set></setters>
  </element>
  <element name="Test Owl" type="Companion" source="Book One" id="ID_ONE_COMPANION_OWL">
    <setters><set name="size">Tiny</set><set name="type">Beast</set><set name="hp">1 (1d4 - 1)</set></setters>
  </element>
  <element name="Test Owl" type="Companion" source="Book Two" id="ID_TWO_COMPANION_OWL">
    <setters><set name="size">Tiny</set><set name="type">Beast</set><set name="hp">3 (1d4 + 1)</set></setters>
  </element>
  <element name="Unused Bite" type="Companion Action" source="Test Book" id="ID_T_ACTION_UNUSED">
    <description><p>Nothing uses this.</p></description>
  </element>`);

const monsterNames = loadSrd51Strings("monsters");
const options = {
  packId: "imp1",
  index: srd51Index,
  nameOf: (id: string) => monsterNames[`${id.split("/")[1]}.name`] ?? id,
};

const entry = (result: AuroraResult, id: string) => {
  const found = result.entries.find((e) => e.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};

describe("reading the stat block of a companion", () => {
  it("reads plain numbers as data", () => {
    expect(parseArmorClass("13 (natural armor)")).toEqual({
      data: [{ type: "natural", value: 13 }],
      verbatim: false,
    });
    expect(parseArmorClass("11")).toEqual({ data: [{ type: "dex", value: 11 }], verbatim: false });
    expect(parseHitPoints("11 (2d8+2)")).toEqual({
      data: { hitPoints: 11, hitDice: "2d8", hitPointsRoll: "2d8+2" },
      verbatim: false,
    });
    expect(parseHitPoints("5 (1d4 + 3)").data).toMatchObject({ hitPointsRoll: "1d4+3" });
    expect(parseSpeed("40 ft., Burrow 5 ft.")).toEqual({
      data: { walk: 40, burrow: 5 },
      verbatim: false,
    });
    expect(parseSpeed("30 ft., fly 60 ft. (hover)").data).toEqual({
      walk: 30,
      fly: 60,
      hover: true,
    });
    expect(parseBonuses("Perception +3, Stealth +4", false)).toEqual({
      data: { perception: 3, stealth: 4 },
      verbatim: false,
    });
    expect(parseBonuses("Dex +1, Wis +2", true).data).toEqual({ dex: 1, wis: 2 });
    expect(parseSenses("darkvision 60 ft., passive Perception 13")).toMatchObject({
      senses: { darkvision: 60 },
      passivePerception: 13,
      verbatim: false,
    });
    expect(parseSenses("blindsight 30ft. (blind beyond this radius)")).toMatchObject({
      senses: { blindsight: 30 },
      blindBeyond: ["blindsight"],
    });
  });

  it("keeps the text of a formula, with what it says in numbers", () => {
    expect(parseArmorClass("14 + PB (natural armor)")).toEqual({
      data: [{ type: "natural", value: 14, plus: "proficiency" }],
      verbatim: true,
    });
    expect(parseHitPoints("equal to five times your level").verbatim).toBe(true);
    expect(parseBonuses("Perception +0 plus PB×2", false).verbatim).toBe(true);
    expect(parseSenses("darkvision 60 ft., passive Perception 10 plus PB×2").verbatim).toBe(true);
    expect(parseSpeed("30 ft., fly 30 ft. (see bad flier below)").verbatim).toBe(true);
  });

  it("reads the challenge, with the experience it is worth", () => {
    expect(parseChallenge("1/4")).toEqual({ challenge: 0.25, xp: 50 });
    expect(parseChallenge("2 (450 XP)")).toEqual({ challenge: 2, xp: 450 });
    expect(parseChallenge("0")).toEqual({ challenge: 0, xp: 10 });
    expect(parseChallenge("—")).toEqual({});
  });

  it("reads what an action says in numbers", () => {
    expect(
      parseAction("Melee Weapon Attack: +4 to hit, reach 5 ft. Hit: 7 (2d4 + 2) piercing damage."),
    ).toEqual({ attackBonus: 4, damage: [{ type: "piercing", dice: "2d4+2" }] });
    expect(parseAction("Hit: 1 slashing damage.")).toEqual({
      damage: [{ type: "slashing", dice: "1" }],
    });
    expect(parseAction("a DC 13 Strength saving throw")).toEqual({
      dc: { ability: "str", value: 13 },
    });
  });
});

describe("the formulas of a creature that grows with its owner", () => {
  it("reads hit points that depend on a level and on modifiers", () => {
    expect(
      parseHitPointScale(
        "5 + five times your ranger level (the beast has a number of Hit Dice [d8s])",
      ),
    ).toEqual({ base: 5, perLevel: 5, owner: [], own: [], class: "ranger" });
    expect(parseHitPointScale("4 + four times your Ranger level")).toMatchObject({
      base: 4,
      perLevel: 4,
    });
    expect(
      parseHitPointScale(
        "equal to five times your level in this class + your Intelligence modifier + the iron defender\u2019s Constitution modifier",
      ),
    ).toEqual({ base: 0, perLevel: 5, owner: ["int"], own: ["con"] });
    expect(
      parseHitPointScale(
        "2 + your Intelligence modifier + five times your artificer level (the defender has a number of Hit Dice [d8s] equal to your artificer level)",
      ),
    ).toEqual({ base: 2, perLevel: 5, owner: ["int"], own: [], class: "artificer" });
    expect(
      parseHitPointScale("1 + your Intelligence modifier + your artificer level (d4s)"),
    ).toEqual({ base: 1, perLevel: 1, owner: ["int"], own: [], class: "artificer" });
    expect(parseHitPointScale("11 (2d8+2)")).toBeUndefined();
  });

  it("reads armor class with an ability modifier", () => {
    expect(parseArmorClass("13 + your Wisdom modifier").data).toEqual([{ value: 13, plus: "wis" }]);
  });

  it("reads bonuses that add the proficiency bonus, a number of times", () => {
    expect(parseScaledBonuses("Dex +1 plus PB, Wis +2 plus PB", true)).toEqual({
      dex: { base: 1, pb: 1 },
      wis: { base: 2, pb: 1 },
    });
    expect(
      parseScaledBonuses("Athletics +2 plus PB, Perception +0 plus PB \u00d7 2", false),
    ).toEqual({
      athletics: { base: 2, pb: 1 },
      perception: { base: 0, pb: 2 },
    });
    expect(parseScaledPassive("darkvision 60 ft., passive Perception 10 + (PB x 2)")).toEqual({
      base: 10,
      pb: 2,
    });
    expect(parseScaledPassive("passive Perception 13")).toBeUndefined();
  });

  it("reads an action that adds the proficiency bonus or a modifier of its owner", () => {
    expect(
      parseAction(
        "Melee Weapon Attack: +4 plus PB to hit, reach 5 ft., one target. Hit: 1d6 plus PB piercing damage.",
      ),
    ).toEqual({
      attackBonus: 4,
      attackPlus: ["pb"],
      damage: [{ type: "piercing", dice: "1d6", plus: ["pb"] }],
    });
    expect(
      parseAction(
        "Melee Weapon Attack: your spell attack modifier to hit, reach 5 ft. Hit: 1d8 + 2 plus your Wisdom modifier slashing damage.",
      ),
    ).toEqual({
      attackBonus: 0,
      attackPlus: ["spell"],
      damage: [{ type: "slashing", dice: "1d8+2", plus: ["wis"] }],
    });
    expect(parseAction("Hit: 1d6+3+PB slashing damage")).toMatchObject({
      damage: [{ type: "slashing", dice: "1d6+3", plus: ["pb"] }],
    });
  });
});

describe("importing companions", () => {
  const result = parseAurora([FILE], options);

  it("turns a companion into a monster with its traits and actions", () => {
    const hawk = entry(result, "imp1:monster/test-hawk");
    expect(hawk.kind).toBe("monster");
    expect(hawk.data).toMatchObject({
      size: "tiny",
      type: "beast",
      armorClass: [{ type: "natural", value: 13 }],
      hitPoints: 1,
      hitPointsRoll: "1d4-1",
      speed: { walk: 10, fly: 60 },
      abilities: { str: 5, dex: 16, con: 8, int: 2, wis: 14, cha: 6 },
      skills: { perception: 4 },
      passivePerception: 14,
      challenge: 0,
      xp: 10,
      proficiencyBonus: 2,
      uses: ["familiar", "variant-familiar"],
      special: [{}],
      actions: [
        { attackBonus: 5, damage: [{ type: "slashing", dice: "1" }] },
        { dc: { ability: "wis", value: 11 } },
      ],
    });
    const text = (field: string) => result.strings[`imp1:monster/test-hawk.${field}`];
    expect(text("name")).toBe("Test Hawk");
    expect(text("desc")).toBe("A small hunter of the sky.");
    expect(text("alignment")).toBe("unaligned");
    expect(text("languages")).toBeUndefined();
    expect(text("special.1.name")).toBe("Keen Sight");
    expect(text("actions.1.name")).toBe("Talons");
    expect(text("actions.2.desc")).toContain("DC 11 Wisdom saving throw");
    // Plain numbers need no text of their own.
    expect(text("armorClass")).toBeUndefined();
    expect(text("hitPoints")).toBeUndefined();
  });

  it("keeps a formula as written and finds the traits a companion is granted", () => {
    const beast = entry(result, "imp1:monster/test-beast-of-the-land");
    const text = (field: string) => result.strings[`imp1:monster/test-beast-of-the-land.${field}`];
    expect(text("armorClass")).toBe("13 + PB (natural armor)");
    expect(text("hitPoints")).toBe("equal to five times your ranger level");
    expect(text("skills")).toBe("Perception +2 plus PB, Stealth +2 plus PB");
    expect(text("saves")).toBe("Dex +2 plus PB");
    expect(text("senses")).toBe("darkvision 60 ft., passive Perception 12 plus PB x 2");
    expect(beast.data).toMatchObject({
      armorClass: [{ value: 13, plus: "proficiency" }],
      speed: { walk: 40, climb: 40 },
      special: [{}],
    });
    expect(beast.data.hitPoints).toBeUndefined();
    expect(beast.data.challenge).toBeUndefined();
    expect(text("special.1.name")).toBe("Keen Sight");
    // What grows with the owner is kept as numbers, to be worked out for whoever has the beast.
    expect(beast.data.scaling).toEqual({
      hitPoints: { base: 0, perLevel: 5, owner: [], own: [], class: "ranger" },
      saves: { dex: { base: 2, pb: 1 } },
      skills: { perception: { base: 2, pb: 1 }, stealth: { base: 2, pb: 1 } },
      passivePerception: { base: 12, pb: 2 },
    });
  });

  it("leaves out what the app already has, and names equal names by their book", () => {
    expect(result.entries.map((e) => e.id)).not.toContain("imp1:monster/wolf");
    expect(result.duplicates).toBe(1);
    const owls = result.entries.filter((e) => e.id.startsWith("imp1:monster/test-owl"));
    expect(owls.map((e) => result.strings[`${e.id}.name`]).sort()).toEqual([
      "Test Owl (Book One)",
      "Test Owl (Book Two)",
    ]);
  });

  it("reports nothing for the traits and actions that only belong to a companion", () => {
    expect(result.skipped).toEqual({});
  });
});
