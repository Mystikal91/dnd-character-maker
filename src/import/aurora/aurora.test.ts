// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { itemData } from "../../data/items";
import { classData, subclassData } from "../../data/progression";
import { type Entry, parsePack } from "../../data/schema";
import { createCharacter } from "../../engine/character";
import { deriveSheet, indexPacks } from "../../engine/derive";
import { SRD51_FILES, loadSrd51Strings, srd51Index, srd51Packs } from "../../test/srd51";
import { AuroraParseError, type AuroraResult, parseAurora, slugify } from "./index";
import { requirementsMet } from "./rules";

// Invented content in the shape of an Aurora file; nothing here comes from a real book.
const wrap = (body: string, title = "Test Set") =>
  `<?xml version="1.0" encoding="utf-8" ?><elements><info><name>${title}</name></info>${body}</elements>`;

const SPELLS = wrap(`
  <element name="Glimmer" type="Spell" source="Test Book" id="ID_TEST_SPELL_GLIMMER">
    <supports>Wizard, Artificer</supports>
    <description>
      <p>A small light appears at a point you choose.</p>
      <p class="indent"><b><i>At Higher Levels.</i></b> The light grows brighter.</p>
    </description>
    <setters>
      <set name="level">1</set>
      <set name="school">Evocation</set>
      <set name="time">1 action</set>
      <set name="duration">1 minute</set>
      <set name="range">30 feet</set>
      <set name="hasVerbalComponent">true</set>
      <set name="hasSomaticComponent">false</set>
      <set name="hasMaterialComponent">true</set>
      <set name="materialComponent">a firefly</set>
      <set name="isConcentration">true</set>
      <set name="isRitual">false</set>
    </setters>
  </element>
  <element name="Glimmer" type="Spell" source="Test Book" id="ID_TEST_SPELL_GLIMMER_2">
    <supports>Cleric</supports>
    <description><p>Another one with the same name.</p></description>
    <setters><set name="level">0</set><set name="school">Divination</set></setters>
  </element>
  <element name="Mystery" type="Companion" source="Test Book" id="ID_TEST_COMPANION">
    <description><p>Not supported.</p></description>
  </element>
  <element name="Test Book" type="Source" source="Internal" id="ID_TEST_SOURCE" />
  <element name="Test Flag" type="Grants" source="Internal" id="ID_TEST_FLAG" />`);

const ITEMS = wrap(`
  <element name="Test Spear" type="Weapon" source="Test Book" id="ID_TEST_WEAPON_SPEAR">
    <supports>ID_INTERNAL_WEAPON_CATEGORY_SIMPLE_MELEE, ID_INTERNAL_DAMAGE_TYPE_PIERCING, ID_INTERNAL_WEAPON_PROPERTY_THROWN, ID_INTERNAL_WEAPON_PROPERTY_VERSATILE</supports>
    <description><p></p></description>
    <setters>
      <set name="cost" currency="gp">1</set>
      <set name="weight" lb="3">3 lb.</set>
      <set name="damage" type="piercing">1d6</set>
      <set name="versatile">1d8</set>
      <set name="range">20/60</set>
    </setters>
  </element>
  <element name="Test Bow" type="Weapon" source="Test Book" id="ID_TEST_WEAPON_BOW">
    <supports>ID_INTERNAL_WEAPON_CATEGORY_MARTIAL_RANGED, ID_INTERNAL_WEAPON_PROPERTY_AMMUNITION, ID_INTERNAL_WEAPON_PROPERTY_TWOHANDED</supports>
    <description><p>A bow.</p></description>
    <setters>
      <set name="cost" currency="pp">2</set>
      <set name="weight" lb="2">2 lb.</set>
      <set name="damage" type="piercing">1d8</set>
      <set name="range">150/600</set>
    </setters>
  </element>
  <element name="Test Mail" type="Armor" source="Test Book" id="ID_TEST_ARMOR_MAIL">
    <supports>ID_INTERNAL_ARMOR_GROUP_MEDIUM</supports>
    <description><p>Rings on leather.</p></description>
    <setters>
      <set name="cost" currency="gp">40</set>
      <set name="weight" lb="20">20 lb.</set>
      <set name="armor">Medium</set>
      <set name="armorClass">13 + Dex modifier (max 2)</set>
      <set name="stealth">Disadvantage</set>
      <set name="strength">13</set>
    </setters>
  </element>
  <element name="Test Plate" type="Armor" source="Test Book" id="ID_TEST_ARMOR_PLATE">
    <supports>ID_INTERNAL_ARMOR_GROUP_HEAVY</supports>
    <description><p></p></description>
    <setters>
      <set name="cost" currency="gp">1,500</set>
      <set name="armor">Heavy</set>
      <set name="armorClass">18</set>
    </setters>
  </element>
  <element name="Rope Thing" type="Item" source="Test Book" id="ID_TEST_ITEM_ROPE">
    <description><p>Fifty feet of it.</p></description>
    <setters>
      <set name="category">Adventuring Gear</set>
      <set name="cost" currency="ep">1</set>
      <set name="weight" lb="10">10 lb.</set>
    </setters>
  </element>
  <element name="Old Tongue" type="Language" source="Test Book" id="ID_TEST_LANGUAGE_OLD">
    <supports>Exotic</supports>
    <description><p>Spoken by the long gone.</p></description>
    <setters><set name="speakers">Scholars</set><set name="script">Runic</set></setters>
  </element>`);

const PEOPLE = wrap(`
  <element name="Lighthouse Keeper" type="Background" source="Test Book" id="ID_T_BG">
    <description><p>You tended a light.</p></description>
    <rules>
      <grant type="Proficiency" id="ID_PROFICIENCY_SKILL_PERCEPTION" />
      <grant type="Proficiency" id="ID_PROFICIENCY_SKILL_SURVIVAL" />
      <select type="Language" name="Language" number="1" supports="Standard||Exotic" />
      <grant type="Background Feature" id="ID_T_BG_FEATURE" requirements="!ID_X" />
      <select type="List" name="Personality Trait" number="2">
        <item id="1">I count everything.</item>
        <item id="2">I whistle.</item>
      </select>
      <select type="List" name="Ideal"><item id="1">Duty. Keep the light.</item></select>
    </rules>
  </element>
  <element name="Feature: Beacon Network" type="Background Feature" source="Test Book" id="ID_T_BG_FEATURE">
    <description><p>Keepers help you.</p></description>
  </element>

  <element name="Dwarf" type="Race" source="Test Book" id="ID_T_DWARF">
    <description><p>Already in the app.</p></description>
    <rules><stat name="constitution" value="2" /></rules>
  </element>
  <element name="Mountain Test Dwarf" type="Sub Race" source="Test Book" id="ID_T_MD">
    <supports>Dwarf</supports>
    <description><p>Tough.</p></description>
    <rules><stat name="strength" value="2" /></rules>
  </element>
  <element name="Sandfolk" type="Race" source="Test Book" id="ID_T_SANDFOLK">
    <description><p>Desert people.</p></description>
    <rules>
      <stat name="constitution" value="2" />
      <stat name="innate speed" value="35" bonus="base" />
      <grant type="Size" id="ID_SIZE_SMALL" />
      <grant type="Vision" id="ID_VISION_DARKVISION" />
      <grant type="Language" id="ID_LANGUAGE_COMMON" />
      <grant type="Racial Trait" id="ID_T_TRAIT_HEAT" />
      <select type="Sub Race" name="Clan" supports="Sandfolk" />
      <select type="Racial Trait" name="Gift" supports="Sandfolk Gift" number="1" />
    </rules>
  </element>
  <element name="Heat Resistance" type="Racial Trait" source="Test Book" id="ID_T_TRAIT_HEAT">
    <description><p>You shrug off heat.</p></description>
    <rules><grant type="Proficiency" id="ID_PROFICIENCY_SKILL_SURVIVAL" /></rules>
  </element>
  <element name="Dune Clan" type="Sub Race" source="Test Book" id="ID_T_SUB">
    <supports>Sandfolk</supports>
    <description><p>Of the dunes.</p></description>
    <rules>
      <stat name="wisdom" value="1" />
      <grant type="Racial Trait" id="ID_T_TRAIT_SAND" />
    </rules>
  </element>
  <element name="Sand Step" type="Racial Trait" source="Test Book" id="ID_T_TRAIT_SAND">
    <description><p>You walk on sand.</p></description>
  </element>
  <element name="Gift of Salt" type="Racial Trait" source="Test Book" id="ID_T_GIFT_SALT">
    <supports>Sandfolk Gift</supports>
    <description><p>Salt.</p></description>
  </element>
  <element name="Gift of Wind" type="Racial Trait" source="Test Book" id="ID_T_GIFT_WIND">
    <supports>Sandfolk Gift</supports>
    <description><p>Wind.</p></description>
  </element>

  <element name="Lucky Star" type="Feat" source="Test Book" id="ID_T_FEAT">
    <requirements>[dex:13]</requirements>
    <description><p>Fortune favors you.</p></description>
    <rules>
      <stat name="strength" value="1" />
      <select type="Ability Score Improvement" name="Lucky" supports="ID_T_ASI_DEXTERITY|ID_T_ASI_WISDOM" />
    </rules>
  </element>`);

const CLASSES = wrap(`
  <element name="Tinkerer" type="Class" source="Test Book" id="ID_T_CLASS">
    <description><p>A maker of clever things.</p></description>
    <setters><set name="hd">d8</set></setters>
    <rules>
      <grant type="Proficiency" id="ID_PROFICIENCY_ARMOR_PROFICIENCY_LIGHT" requirements="!ID_T_MULTICLASS" />
      <grant type="Proficiency" id="ID_PROFICIENCY_SAVINGTHROW_INTELLIGENCE" requirements="!ID_T_MULTICLASS" />
      <select type="Proficiency" name="Skill" supports="Skill,Tinkerer" number="2" requirements="!ID_T_MULTICLASS" />
      <grant type="Class Feature" id="ID_T_SPELLCASTING" level="1" />
      <grant type="Class Feature" id="ID_T_GADGETS" level="2" />
      <grant type="Class Feature" id="ID_T_PATH" level="3" />
      <grant type="Class Feature" id="ID_T_ASI" level="4" />
    </rules>
    <multiclass id="ID_T_MULTICLASS">
      <prerequisite>Intelligence 13</prerequisite>
      <requirements>[int:13]</requirements>
      <rules>
        <grant type="Grants" id="ID_INTERNAL_GRANT_MULTICLASS" />
        <grant type="Proficiency" id="ID_PROFICIENCY_ARMOR_PROFICIENCY_LIGHT" />
      </rules>
    </multiclass>
  </element>
  <element name="Spellcasting" type="Class Feature" source="Test Book" id="ID_T_SPELLCASTING">
    <description><p>You cast spells.</p></description>
    <spellcasting name="Tinkerer" ability="Intelligence" prepare="true"><list known="true">Tinkerer</list></spellcasting>
    <rules>
      <stat name="tinkerer:spellcasting:slots:1" value="2" level="1" />
      <stat name="tinkerer:spellcasting:slots:1" value="1" level="2" />
      <stat name="tinkerer:spellcasting:slots:2" value="2" level="3" />
      <stat name="tinkerer:spellcasting:prepare" value="intelligence:modifier" />
      <stat name="tinkerer:spellcasting:prepare" value="level:tinkerer:half" />
      <select type="Spell" name="Cantrip (Tinkerer)" supports="$(spellcasting:list), 0" level="1" number="2" spellcasting="Tinkerer" />
      <select type="Spell" name="Cantrip (Tinkerer)" supports="$(spellcasting:list), 0" level="4" number="1" spellcasting="Tinkerer" />
    </rules>
  </element>
  <element name="Gadgets" type="Class Feature" source="Test Book" id="ID_T_GADGETS">
    <description><p>You build gadgets.</p></description>
  </element>
  <element name="Tinker Path" type="Class Feature" source="Test Book" id="ID_T_PATH">
    <description><p>Choose a path.</p></description>
    <rules><select type="Archetype" name="Tinker Path" supports="Tinker Path" level="3" /></rules>
  </element>
  <element name="Ability Score Improvement" type="Class Feature" source="Test Book" id="ID_T_ASI">
    <description><p>Improve.</p></description>
    <rules>
      <select type="Class Feature" name="Improvement Option (4)" supports="Improvement Option,Tinkerer,4" level="4" />
      <select type="Class Feature" name="Improvement Option (8)" supports="Improvement Option,Tinkerer,8" level="8" />
    </rules>
  </element>
  <element name="Clockwork" type="Archetype" source="Test Book" id="ID_T_ARCH">
    <supports>Tinker Path</supports>
    <description><p>Gears and springs.</p></description>
    <rules>
      <grant type="Archetype Feature" id="ID_T_ARCH_F1" level="3" />
      <grant type="Archetype Feature" id="ID_T_ARCH_F2" level="7" />
      <grant type="Spell" id="ID_TEST_SPELL_GLIMMER" level="3" />
    </rules>
  </element>
  <element name="Spring Loaded" type="Archetype Feature" source="Test Book" id="ID_T_ARCH_F1">
    <description><p>Boing.</p></description>
  </element>
  <element name="Wound Tight" type="Archetype Feature" source="Test Book" id="ID_T_ARCH_F2">
    <description><p>Tick.</p></description>
  </element>`);

/** The app's own entries and names, as the reader needs them. */
const names = new Map<string, string>();
for (const file of SRD51_FILES) {
  const strings = loadSrd51Strings(file);
  for (const id of srd51Index.keys()) {
    const slug = id.split("/")[1];
    const name = strings[`${slug}.name`];
    if (name && id.includes(`:${file.replace(/s$/, "").replace("ie", "y")}/`)) names.set(id, name);
  }
}
for (const [id, entry] of srd51Index) {
  if (!names.has(id)) {
    const strings = SRD51_FILES.map(loadSrd51Strings).find((s) => s[`${id.split("/")[1]}.name`]);
    names.set(id, strings?.[`${id.split("/")[1]}.name`] ?? entry.id);
  }
}
const options = {
  packId: "imp1",
  index: srd51Index,
  nameOf: (id: string) => names.get(id) ?? id,
};

const byId = (result: AuroraResult, id: string): Entry => {
  const found = result.entries.find((e) => e.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};

describe("slugify", () => {
  it("makes ids the pack schema accepts", () => {
    expect(slugify("Tasha’s Cauldron")).toBe("tashas-cauldron");
    expect(slugify("  Épée Longue!! ")).toBe("epee-longue");
  });
});

describe("spells", () => {
  const result = parseAurora([SPELLS], options);

  it("reads a spell's facts and texts", () => {
    expect(byId(result, "imp1:spell/glimmer").data).toEqual({
      level: 1,
      school: "evocation",
      components: ["V", "M"],
      ritual: false,
      concentration: true,
      classes: ["srd51:class/wizard"], // Artificer is not in the app
    });
    expect(result.strings["imp1:spell/glimmer.desc"]).toBe(
      "A small light appears at a point you choose.",
    );
    expect(result.strings["imp1:spell/glimmer.higherLevel"]).toBe("The light grows brighter.");
    expect(result.strings["imp1:spell/glimmer.castingTime"]).toBe("1 action");
    expect(result.strings["imp1:spell/glimmer.material"]).toBe("a firefly");
  });

  it("gives equal names their own ids, and reports what it cannot import", () => {
    expect(result.entries.map((e) => e.id)).toEqual(["imp1:spell/glimmer", "imp1:spell/glimmer-2"]);
    // Companions are not read; books and flags are definitions, nothing to report.
    expect(result.skipped).toEqual({ Companion: 1 });
    expect(result.sources).toEqual(["Test Book"]);
    expect(result.title).toBe("Test Set");
  });
});

describe("items", () => {
  const result = parseAurora([ITEMS], options);
  const item = (slug: string) => itemData(byId(result, `imp1:item/${slug}`));

  it("reads weapons, armor, gear and languages", () => {
    expect(item("test-spear")).toMatchObject({
      category: "weapon",
      cost: { amount: 1, unit: "gp" },
      weight: 3,
      weapon: {
        category: "simple",
        kind: "melee",
        damage: { dice: "1d6", type: "piercing" },
        twoHandedDamage: { dice: "1d8", type: "piercing" },
        properties: ["srd51:property/thrown", "srd51:property/versatile"],
        range: { normal: 5 },
        throwRange: { normal: 20, long: 60 },
      },
    });
    expect(item("test-bow")).toMatchObject({
      cost: { amount: 20, unit: "gp" },
      weapon: { category: "martial", kind: "ranged", range: { normal: 150, long: 600 } },
    });
    expect(item("test-mail").armor).toMatchObject({
      base: 13,
      dexBonus: true,
      maxDexBonus: 2,
      strengthMinimum: 13,
    });
    expect(item("test-plate")).toMatchObject({ cost: { amount: 1500, unit: "gp" } });
    expect(item("rope-thing")).toMatchObject({ cost: { amount: 5, unit: "sp" } });
    expect(result.strings["imp1:language/old-tongue.speakers"]).toBe("Scholars");
  });
});

describe("backgrounds, races and feats", () => {
  const result = parseAurora([PEOPLE], options);

  it("reads a background with its proficiencies, language choice, feature and tables", () => {
    const bg = byId(result, "imp1:background/lighthouse-keeper");
    expect(bg.effects).toEqual([
      { type: "proficiency", category: "skill", target: "perception" },
      { type: "proficiency", category: "skill", target: "survival" },
      expect.objectContaining({ type: "choice", grants: "language", choose: 1 }),
    ]);
    expect(bg.data).toEqual({ choose: { personalityTraits: 2, ideals: 1 } });
    expect(result.strings["imp1:background/lighthouse-keeper.featureName"]).toBe("Beacon Network");
    expect(result.strings["imp1:background/lighthouse-keeper.featureDesc"]).toBe(
      "Keepers help you.",
    );
    expect(result.strings["imp1:background/lighthouse-keeper.personalityTraits.2"]).toBe(
      "I whistle.",
    );
    expect(result.strings["imp1:background/lighthouse-keeper.ideals.1"]).toBe(
      "Duty. Keep the light.",
    );
  });

  it("reads a race with its traits, and leaves out a race the app already has", () => {
    expect(result.entries.some((e) => e.id.endsWith("species/dwarf"))).toBe(false);
    const race = byId(result, "imp1:species/sandfolk");
    expect(race.data).toEqual({ speed: 35, size: "small" });
    expect(race.effects).toEqual(
      expect.arrayContaining([
        { type: "abilityBonus", ability: "con", value: 2 },
        { type: "trait", id: "srd51:trait/darkvision" },
        { type: "proficiency", category: "language", target: "common" },
        { type: "trait", id: "imp1:trait/heat-resistance" },
      ]),
    );
    // "Choose one gift": the options are created as traits and offered as a choice.
    const choice = race.effects.find((e) => e.type === "choice" && e.grants === "trait");
    expect(choice).toMatchObject({
      choose: 1,
      from: ["imp1:trait/gift-of-salt", "imp1:trait/gift-of-wind"],
    });
    expect(byId(result, "imp1:trait/heat-resistance").effects).toEqual([
      { type: "proficiency", category: "skill", target: "survival" },
    ]);
  });

  it("attaches sub-races to their race, in the pack or in the app", () => {
    expect(byId(result, "imp1:subspecies/dune-clan").parent).toBe("imp1:species/sandfolk");
    expect(byId(result, "imp1:subspecies/mountain-test-dwarf").parent).toBe("srd51:species/dwarf");
    expect(byId(result, "imp1:trait/sand-step")).toBeTruthy();
  });

  it("reads a feat with its prerequisite and ability choice", () => {
    const feat = byId(result, "imp1:feat/lucky-star");
    expect(feat.data).toMatchObject({ prerequisites: [{ ability: "dex", minimum: 13 }] });
    expect(feat.effects).toEqual([
      { type: "abilityBonus", ability: "str", value: 1 },
      expect.objectContaining({
        type: "choice",
        grants: "abilityBonus",
        from: ["dex", "wis"],
        value: 1,
      }),
    ]);
  });

  it("makes a pack that passes the schema and works in a character", () => {
    const pack = parsePack({
      manifest: {
        id: "imp1",
        ruleset: "custom",
        version: "1",
        license: "Personal",
        attribution: "x",
      },
      entries: result.entries,
    });
    const index = indexPacks(...srd51Packs, pack);
    const c = createCharacter("srd51");
    c.choices.species = "imp1:species/sandfolk";
    c.choices.subspecies = "imp1:subspecies/dune-clan";
    c.choices.background = "imp1:background/lighthouse-keeper";
    const sheet = deriveSheet(c, index);
    expect(sheet.speed).toBe(35);
    expect(sheet.abilities.con.bonus).toBe(2);
    expect(sheet.abilities.wis.bonus).toBe(1);
    expect(sheet.traits).toEqual(
      expect.arrayContaining([
        "srd51:trait/darkvision",
        "imp1:trait/heat-resistance",
        "imp1:trait/sand-step",
      ]),
    );
    expect(sheet.proficiencies.skill).toEqual(expect.arrayContaining(["perception", "survival"]));
  });
});

describe("classes and archetypes", () => {
  const result = parseAurora([SPELLS, CLASSES], options);
  const cls = byId(result, "imp1:class/tinkerer");

  it("reads the hit die, spellcasting, levels and multiclassing", () => {
    const data = classData(cls);
    expect(data.hitDie).toBe(8);
    expect(data.spellcasting).toEqual({
      ability: "int",
      startsAtLevel: 1,
      preparation: { type: "prepared", levelDivisor: 2 },
    });
    expect(data.levels).toHaveLength(20);
    expect(data.levels[0]?.features).toEqual(["imp1:feature/spellcasting"]);
    expect(data.levels[1]?.features).toEqual(["imp1:feature/gadgets"]);
    expect(data.levels[1]?.spellSlots).toEqual([3, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(data.levels[2]?.spellSlots).toEqual([3, 2, 0, 0, 0, 0, 0, 0, 0]);
    expect(data.levels[0]?.cantripsKnown).toBe(2);
    expect(data.levels[3]?.cantripsKnown).toBe(3);
    expect(data.levels[3]?.abilityScoreImprovements).toBe(1);
    expect(data.levels[7]?.abilityScoreImprovements).toBe(2);
    expect(data.multiclassing).toMatchObject({
      prerequisites: [{ ability: "int", minimum: 13 }],
      proficiencies: ["armor:light-armor"],
    });
  });

  it("reads Pact Magic as slots of one growing level", () => {
    const pact = wrap(`
      <element name="Binder" type="Class" source="Test Book" id="ID_B_CLASS">
        <description><p>Bound by pacts.</p></description>
        <setters><set name="hd">d8</set></setters>
        <rules><grant type="Class Feature" id="ID_B_PACT" level="1" /></rules>
      </element>
      <element name="Pact Magic" type="Class Feature" source="Test Book" id="ID_B_PACT">
        <description><p>Pacts.</p></description>
        <spellcasting name="Binder" ability="Charisma"><list known="true">Binder</list></spellcasting>
        <rules>
          <stat name="binder:spellcasting:slots:count" value="1" level="1" />
          <stat name="binder:spellcasting:slots:count" value="1" level="2" />
          <stat name="binder:spellcasting:slot" value="1" level="1" />
          <stat name="binder:spellcasting:slot" value="1" level="3" />
        </rules>
      </element>`);
    const data = classData(byId(parseAurora([pact], options), "imp1:class/binder"));
    expect(data.spellcasting?.pact).toBe(true);
    expect(data.levels[0]?.spellSlots).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(data.levels[1]?.spellSlots).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(data.levels[2]?.spellSlots).toEqual([0, 2, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("gives the starting class its proficiencies and skill choice", () => {
    expect(cls.effects).toEqual(
      expect.arrayContaining([
        { type: "proficiency", category: "armor", target: "light-armor" },
        { type: "proficiency", category: "save", target: "int" },
        expect.objectContaining({ type: "choice", grants: "proficiency", choose: 2 }),
      ]),
    );
  });

  it("owns its features and links the archetype to the class", () => {
    expect(byId(result, "imp1:feature/gadgets").data).toEqual({
      class: "imp1:class/tinkerer",
      level: 2,
    });
    const sub = byId(result, "imp1:subclass/clockwork");
    expect(sub.parent).toBe("imp1:class/tinkerer");
    expect(subclassData(sub)).toEqual({
      levels: [
        { level: 3, features: ["imp1:feature/spring-loaded"] },
        { level: 7, features: ["imp1:feature/wound-tight"] },
      ],
      spells: [{ spell: "imp1:spell/glimmer", classLevel: 3 }],
      expanded: [],
    });
    expect(result.strings["imp1:subclass/clockwork.flavor"]).toBe("Tinker Path");
    expect(byId(result, "imp1:feature/spring-loaded").data).toMatchObject({
      class: "imp1:class/tinkerer",
      subclass: "imp1:subclass/clockwork",
      level: 3,
    });
  });

  it("attaches an archetype to a class the app already has", () => {
    const patron = wrap(`
      <element name="The Hexblade" type="Archetype" source="Test Book" id="ID_H">
        <supports>Otherworldly Patron</supports>
        <description><p>A pact with a sentient weapon.</p></description>
        <rules><grant type="Archetype Feature" id="ID_H_F1" level="1" /></rules>
      </element>
      <element name="Hex Warrior" type="Archetype Feature" source="Test Book" id="ID_H_F1">
        <supports>Warlock</supports>
        <description><p>You wear armor.</p></description>
      </element>`);
    const made = parseAurora([patron], options);
    const sub = byId(made, "imp1:subclass/the-hexblade");
    expect(sub.parent).toBe("srd51:class/warlock");
    expect(made.skipped.Archetype).toBeUndefined();
    expect(byId(made, "imp1:feature/hex-warrior").data).toMatchObject({
      class: "srd51:class/warlock",
      level: 1,
    });
  });

  it("gives a subclass of a class that does not cast its own spellcasting", () => {
    const knight = wrap(`
      <element name="Spell Knight" type="Archetype" source="Test Book" id="ID_SK">
        <supports>Martial Archetype</supports>
        <description><p>A fighter who casts.</p></description>
        <rules><grant type="Archetype Feature" id="ID_SK_CAST" level="3" /></rules>
      </element>
      <element name="Spellcasting" type="Archetype Feature" source="Test Book" id="ID_SK_CAST">
        <supports>Fighter</supports>
        <description><p>You cast.</p></description>
        <spellcasting name="Spell Knight" ability="Intelligence"><list known="true">Wizard</list></spellcasting>
        <rules>
          <stat name="spell knight:spellcasting:slots:1" value="2" level="3" />
          <stat name="spell knight:spellcasting:slots:1" value="1" level="4" />
          <stat name="spell knight:spellcasting:slots:1" value="1" level="7" />
          <stat name="spell knight:spellcasting:slots:2" value="2" level="7" />
          <select type="Spell" name="Cantrip (Spell Knight)" supports="Wizard, 0" level="3" number="2" spellcasting="Spell Knight" />
          <select type="Spell" name="Spell (Spell Knight)" supports="Wizard" level="3" number="3" spellcasting="Spell Knight" />
          <select type="Spell" name="Spell (Spell Knight)" supports="Wizard" level="4" spellcasting="Spell Knight" />
        </rules>
      </element>`);
    const made = parseAurora([knight], options);
    const sub = byId(made, "imp1:subclass/spell-knight");
    expect(sub.parent).toBe("srd51:class/fighter");
    const data = subclassData(sub);
    expect(data.spellcasting).toEqual({
      ability: "int",
      list: "srd51:class/wizard",
      startsAtLevel: 3,
      kind: "third",
    });
    const row = (level: number) => data.levels.find((l) => l.level === level);
    expect(row(3)).toMatchObject({
      cantripsKnown: 2,
      spellsKnown: 3,
      spellSlots: [2, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(row(4)?.spellSlots).toEqual([3, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(row(7)?.spellSlots).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0]);

    // It works in a character: a fighter of level 3 with this subclass casts.
    const index = new Map([...srd51Index, ...made.entries.map((e) => [e.id, e] as const)]);
    const c = createCharacter("srd51");
    c.classes = [{ classId: "srd51:class/fighter", level: 3, subclassId: sub.id }];
    const sheet = deriveSheet(c, index);
    expect(sheet.spellcasters).toHaveLength(1);
    expect(sheet.spellcasters[0]?.cantripsKnown).toBe(2);
    expect(sheet.spellSlots).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("tells apart entries that share a name by their book", () => {
    const twice = wrap(`
      <element name="Pebblekin" type="Race" source="First Book" id="ID_A_PEBBLE">
        <description><p>From the first book.</p></description>
        <rules><stat name="strength" value="1" /></rules>
      </element>
      <element name="Pebblekin" type="Race" source="Second Book" id="ID_B_PEBBLE">
        <description><p>From the second book.</p></description>
        <rules><stat name="dexterity" value="1" /></rules>
      </element>
      <element name="Loneliest" type="Race" source="First Book" id="ID_A_LONE">
        <description><p>Only one.</p></description>
      </element>`);
    const made = parseAurora([twice], options);
    expect(made.strings["imp1:species/pebblekin.name"]).toBe("Pebblekin (First Book)");
    expect(made.strings["imp1:species/pebblekin-2.name"]).toBe("Pebblekin (Second Book)");
    expect(made.strings["imp1:species/loneliest.name"]).toBe("Loneliest");
  });

  it("works in a character sheet", () => {
    const pack = parsePack({
      manifest: {
        id: "imp1",
        ruleset: "custom",
        version: "1",
        license: "Personal",
        attribution: "x",
      },
      entries: result.entries,
    });
    const index = indexPacks(...srd51Packs, pack);
    const c = createCharacter("srd51");
    c.classes = [
      { classId: "imp1:class/tinkerer", level: 3, subclassId: "imp1:subclass/clockwork" },
    ];
    c.abilityBase = { str: 10, dex: 12, con: 14, int: 16, wis: 10, cha: 8 };
    const sheet = deriveSheet(c, index);
    expect(sheet.warnings).toEqual([]);
    expect(sheet.hitPoints.hitDice).toEqual({ d8: 3 });
    expect(sheet.features).toEqual(
      expect.arrayContaining([
        "imp1:feature/spellcasting",
        "imp1:feature/gadgets",
        "imp1:feature/spring-loaded",
      ]),
    );
    expect(sheet.spellcasting).toMatchObject({ classId: "imp1:class/tinkerer", ability: "int" });
    expect(sheet.spellSlots).toEqual([3, 2, 0, 0, 0, 0, 0, 0, 0]);
    expect(sheet.spellcasting?.lists.alwaysPrepared).toEqual(["imp1:spell/glimmer"]);
  });
});

describe("options and errors", () => {
  it("leaves out what the app already has", () => {
    const only = wrap(`
      <element name="Fireball" type="Spell" source="Test Book" id="ID_X_FIREBALL">
        <supports>Wizard</supports><description><p>x</p></description>
        <setters><set name="level">3</set><set name="school">Evocation</set></setters>
      </element>`);
    const result = parseAurora([only], options);
    expect(result.entries).toHaveLength(0);
    expect(result.duplicates).toBe(1);
  });

  it("rejects text that is not an Aurora file", () => {
    expect(() => parseAurora(["not xml at all <<"], options)).toThrow(AuroraParseError);
    expect(() => parseAurora(["<other><x/></other>"], options)).toThrow(AuroraParseError);
  });
});

const LEGACY = wrap(`
  <element name="Test Smith" type="Class" source="Test Book" id="ID_L_CLASS_SMITH">
    <description><p>Makes things.</p></description>
    <setters><set name="hd">d8</set></setters>
    <rules>
      <grant type="Class Feature" id="ID_L_FEATURE_SPECIALIST" level="3" />
    </rules>
  </element>
  <element name="Test Smith" type="Class" source="Other Book" id="ID_L_CLASS_SMITH_2">
    <description><p>Makes things, another way.</p></description>
    <setters><set name="hd">d8</set></setters>
    <rules>
      <grant type="Class Feature" id="ID_L_FEATURE_SPECIALIST_2" level="3" />
    </rules>
  </element>
  <element name="Specialist" type="Class Feature" source="Test Book" id="ID_L_FEATURE_SPECIALIST">
    <description><p>Pick a specialty.</p></description>
    <rules><select type="Archetype" name="Specialty" supports="Specialty, !Other Version" /></rules>
  </element>
  <element name="Specialist" type="Class Feature" source="Other Book" id="ID_L_FEATURE_SPECIALIST_2">
    <description><p>Pick a specialty.</p></description>
    <rules><select type="Archetype" name="Specialty" supports="Specialty, !Base Version" /></rules>
  </element>
  <element name="Gilder" type="Archetype" source="Test Book" id="ID_L_ARCH_GILDER">
    <supports>Specialty, Base Version</supports>
    <description><p>Gold work.</p></description>
  </element>
  <element name="Gilder" type="Archetype" source="Other Book" id="ID_L_ARCH_GILDER_2">
    <supports>Specialty, Other Version</supports>
    <description><p>Gold work, the other way.</p></description>
  </element>
  <element name="Merfolk" type="Race" source="Test Book" id="ID_L_RACE_MERFOLK">
    <description><p>Of the water.</p></description>
    <rules>
      <grant type="Racial Trait" id="ID_L_TRAIT_CREED" />
      <grant type="Proficiency" id="ID_PROFICIENCY_WEAPON_PROFICIENCY_CROSSBOW_HAND" />
    </rules>
  </element>
  <element name="Creed" type="Racial Trait" source="Test Book" id="ID_L_TRAIT_CREED">
    <description><p>Choose a creed.</p></description>
    <rules><select type="Sub Race" name="Creed" supports="Tide Creed" /></rules>
  </element>
  <element name="Blue Tide" type="Sub Race" source="Test Book" id="ID_L_SUB_BLUE">
    <supports>Tide Creed</supports>
    <description><p>Deep water.</p></description>
  </element>
  <element name="Thunder Cannon" type="Weapon" source="Test Book" id="ID_L_WEAPON_CANNON">
    <supports>ID_INTERNAL_WEAPON_CATEGORY_FIREARM, ID_INTERNAL_DAMAGE_TYPE_PIERCING</supports>
    <description><p>Boom.</p></description>
    <setters>
      <set name="cost" currency="gp">100</set>
      <set name="damage" type="piercing">2d6</set>
      <set name="range">150/500</set>
    </setters>
  </element>
  <element name="Ring of Testing" type="Magic Item" source="Test Book" id="ID_L_MAGIC_RING">
    <description><p>It glows when you pass a test.</p></description>
    <setters>
      <set name="category">Rings</set>
      <set name="type">Ring</set>
      <set name="rarity">Very Rare</set>
      <set name="attunement">true</set>
      <set name="cost" currency="gp">0</set>
    </setters>
  </element>
  <element name="Auril" type="Deity" source="Test Book" id="ID_L_DEITY_AURIL">
    <description><p class="flavor">goddess of winter</p></description>
    <setters>
      <set name="setting">Test Realms</set>
      <set name="alignment">NE</set>
      <set name="domains">Nature, Tempest</set>
      <set name="symbol">A snowflake</set>
    </setters>
  </element>
  <element name="Custom Folk" type="Race" source="Test Book" id="ID_L_RACE_CUSTOM">
    <description><p>Build your own.</p></description>
    <rules>
      <select type="Ability Score Improvement" name="Increase +2" supports="Custom Ability Score Increase 2" requirements="!ID_INTERNAL_GRANTS_BACKGROUND_ASI" />
      <select type="Ability Score Improvement" name="Increase +1" supports="Custom Ability Score Increase 1" requirements="ID_OPTION_NEVER_HELD" />
    </rules>
  </element>
  <element name="Gifted Folk" type="Race" source="Test Book" id="ID_L_RACE_GIFTED">
    <description><p>With a feat.</p></description>
    <rules>
      <select type="Feat" name="Feat (Gifted)" />
      <select type="Feat" name="Origin Feat" supports="Origin" />
      <grant type="Feat" id="ID_L_FEAT_TOUGH" />
    </rules>
  </element>
  <element name="Tough" type="Feat" source="Test Book" id="ID_L_FEAT_TOUGH">
    <description><p>You are tough.</p></description>
  </element>
  <element name="Lucky" type="Feat" source="Test Book" id="ID_L_FEAT_LUCKY">
    <supports>Origin</supports>
    <description><p>You are lucky.</p></description>
  </element>
  <element name="Stonefolk" type="Race" source="Test Book" id="ID_L_RACE_STONE">
    <description><p>Hard to hurt.</p></description>
    <rules>
      <grant type="Condition" id="ID_INTERNAL_CONDITION_DAMAGE_RESISTANCE_NECROTIC" />
      <grant type="Condition" id="ID_INTERNAL_CONDITION_DAMAGE_IMMUNITY_POISON" />
      <grant type="Condition" id="ID_INTERNAL_CONDITION_DAMAGE_VULNERAILITY_FIRE" />
    </rules>
  </element>
  <element name="Grim Touch" type="Spell" source="Test Book" id="ID_L_SPELL_GRIM">
    <supports>Wizard</supports>
    <description><p>A cold hand.</p></description>
    <setters><set name="level">0</set><set name="school">Necromancy</set></setters>
  </element>
  <element name="Light Dab" type="Spell" source="Test Book" id="ID_L_SPELL_DAB">
    <supports>Wizard</supports>
    <description><p>A spark.</p></description>
    <setters><set name="level">0</set><set name="school">Evocation</set></setters>
  </element>
  <element name="Gravefolk" type="Race" source="Test Book" id="ID_L_RACE_GRAVE">
    <description><p>Of the tombs.</p></description>
    <rules>
      <select type="Spell" name="Cantrip" supports="0,Necromancy" />
      <select type="Spell" name="Another" supports="(0||1),(Evocation||Illusion),Wizard" />
      <select type="Spell" name="Per slot" supports="$(spellcasting:slots),Wizard" />
    </rules>
  </element>
  <element name="Toolfolk" type="Race" source="Test Book" id="ID_L_RACE_TOOLS">
    <description><p>Handy.</p></description>
    <rules>
      <select type="Proficiency" name="Tool" supports="Gaming Set||Musical Instrument" number="2" />
      <select type="Proficiency" name="Odd" supports="Simple||Tool" />
      <grant type="Proficiency" id="ID_PROFICIENCY_ARMOR_PROFICIENCY_SHIELD" />
    </rules>
  </element>
  <element name="Dune Race" type="Race" source="Test Book" id="ID_V_RACE">
    <description><p>Of the dunes.</p></description>
    <rules>
      <stat name="strength" value="2" requirements="!(ID_V_FLAG||ID_V_OTHER)" />
      <stat name="constitution" value="1" />
      <grant type="Racial Trait" id="ID_V_TRAIT_OLD" requirements="!ID_V_FLAG" />
      <select type="Race Variant" name="Variant" supports="Dune Variant" optional="true" />
    </rules>
  </element>
  <element name="Old Trick" type="Racial Trait" source="Test Book" id="ID_V_TRAIT_OLD">
    <description><p>An old trick.</p></description>
  </element>
  <element name="New Trick" type="Racial Trait" source="Test Book" id="ID_V_TRAIT_NEW">
    <description><p>A new trick.</p></description>
  </element>
  <element name="Variant Flag" type="Grants" source="Internal" id="ID_V_FLAG" />
  <element name="Dune Wanderer" type="Race Variant" source="Test Book" id="ID_V_VARIANT">
    <supports>Dune Variant</supports>
    <description><p>Of the far dunes.</p></description>
    <rules>
      <grant type="Grants" id="ID_V_FLAG" />
      <grant type="Racial Trait" id="ID_V_TRAIT_NEW" />
      <stat name="dexterity" value="2" />
    </rules>
  </element>
  <element name="Dwarf" type="Race" source="Test Book" id="ID_V_DWARF">
    <description><p>Already in the app.</p></description>
    <rules>
      <stat name="constitution" value="2" requirements="!ID_V_FLAG2" />
      <select type="Race Variant" name="Variant" supports="Dwarf Variant" optional="true" />
    </rules>
  </element>
  <element name="Flag Two" type="Grants" source="Internal" id="ID_V_FLAG2" />
  <element name="Scholar Dwarf" type="Race Variant" source="Test Book" id="ID_V_SCHOLAR">
    <supports>Dwarf Variant</supports>
    <description><p>Bookish.</p></description>
    <rules>
      <grant type="Grants" id="ID_V_FLAG2" />
      <stat name="intelligence" value="2" />
    </rules>
  </element>
  <element name="Test Proficiency" type="Proficiency" source="Internal" id="ID_L_PROF" />
  <element name="Test Rule" type="Rule" source="Internal" id="ID_L_RULE" />`);

describe("collections written for other readers", () => {
  const result = parseAurora([LEGACY], options);

  it("keeps each version of a class with its own archetypes, even when tags exclude each other", () => {
    const parents = result.entries
      .filter((e) => e.kind === "subclass")
      .map((e) => [e.id, e.parent] as const);
    expect(parents).toHaveLength(2);
    expect(new Set(parents.map(([, parent]) => parent)).size).toBe(2);
  });

  it("finds the race that offers a sub-race through one of its traits", () => {
    const sub = byId(result, "imp1:subspecies/blue-tide");
    expect(sub.parent).toBe("imp1:species/merfolk");
    expect(result.skipped["Sub Race"]).toBeUndefined();
  });

  it("maps a proficiency written in another word order, and a firearm with no other category", () => {
    const race = byId(result, "imp1:species/merfolk");
    expect(race.effects).toContainEqual({
      type: "proficiency",
      category: "weapon",
      target: "hand-crossbows",
    });
    expect(itemData(byId(result, "imp1:item/thunder-cannon")).weapon).toMatchObject({
      category: "martial",
      kind: "ranged",
      range: { normal: 150, long: 500 },
    });
  });

  it("imports magic items as items, with their rarity and attunement in the text", () => {
    const ring = byId(result, "imp1:item/ring-of-testing");
    expect(itemData(ring).category).toBe("rings");
    expect(ring.data).toMatchObject({ rarity: "very-rare", attunement: true });
    expect(result.strings["imp1:item/ring-of-testing.desc"]).toBe(
      "Ring, very rare (requires attunement)\n\nIt glows when you pass a test.",
    );
  });

  it("imports deities, with the alignment the app knows and a line of facts", () => {
    const deity = byId(result, "imp1:deity/auril");
    expect(deity.data).toMatchObject({
      alignment: "srd51:alignment/neutral-evil",
      domains: "Nature, Tempest",
    });
    expect(result.strings["imp1:deity/auril.desc"]).toContain(
      "Test Realms \u00b7 Neutral Evil \u00b7 Domains: Nature, Tempest \u00b7 Symbol: A snowflake",
    );
  });

  it("reads Tasha's custom ability increase as a choice of any ability", () => {
    const race = byId(result, "imp1:species/custom-folk");
    expect(race.effects).toEqual([
      {
        type: "choice",
        id: "species-1",
        choose: 1,
        grants: "abilityBonus",
        from: ["str", "dex", "con", "int", "wis", "cha"],
        value: 2,
      },
    ]);
  });

  it("reads a feat choice and a granted feat", () => {
    const race = byId(result, "imp1:species/gifted-folk");
    expect(race.effects).toEqual([
      { type: "choice", id: "species-1", choose: 1, grants: "feat", from: [] },
      { type: "choice", id: "species-2", choose: 1, grants: "feat", from: ["imp1:feat/lucky"] },
      { type: "trait", id: "imp1:feat/tough" },
    ]);
  });

  it("reads resistances, immunities and vulnerabilities", () => {
    const race = byId(result, "imp1:species/stonefolk");
    expect(race.effects).toEqual([
      { type: "defense", kind: "resistance", damage: "necrotic" },
      { type: "defense", kind: "immunity", damage: "poison" },
      { type: "defense", kind: "vulnerability", damage: "fire" },
    ]);
  });

  it("offers the spells a select asks for by level, school, class and alternatives", () => {
    const race = byId(result, "imp1:species/gravefolk");
    const picks = race.effects.flatMap((e) => (e.type === "choice" ? [e.from] : []));
    expect(picks).toHaveLength(2); // the one that depends on spell slots is left out
    expect(picks[0]).toContain("imp1:spell/grim-touch");
    expect(picks[0]).toContain("srd51:spell/chill-touch");
    expect(picks[0]).not.toContain("imp1:spell/light-dab");
    expect(picks[1]).toContain("imp1:spell/light-dab");
    expect(picks[1]).toContain("srd51:spell/magic-missile");
    expect(picks[1]).not.toContain("imp1:spell/grim-touch");
  });

  it("offers groups of tools, and finds the shield proficiency", () => {
    const race = byId(result, "imp1:species/toolfolk");
    const choices = race.effects.flatMap((e) => (e.type === "choice" ? [e] : []));
    expect(choices).toHaveLength(1); // "Simple||Tool" mixes weapons in and is left alone
    expect(choices[0]).toMatchObject({ choose: 2, grants: "proficiency" });
    expect(choices[0]?.from).toContain("tool:dice-set");
    expect(choices[0]?.from).toContain("tool:lute");
    expect(choices[0]?.from).not.toContain("tool:thieves-tools");
    expect(race.effects).toContainEqual({
      type: "proficiency",
      category: "armor",
      target: "shields",
    });
  });

  it("reads a requirement that negates a whole group", () => {
    const held = new Set(["B"]);
    expect(requirementsMet("!(A||B)", held)).toBe(false);
    expect(requirementsMet("!(A||B)", new Set(["C"]))).toBe(true);
    expect(requirementsMet("A,!B", new Set(["A"]))).toBe(true);
    expect(requirementsMet("A,!B", new Set(["A", "B"]))).toBe(false);
    expect(requirementsMet("(A||B),C", new Set(["B", "C"]))).toBe(true);
    expect(requirementsMet("A||B,C", new Set(["B"]))).toBe(false);
    expect(requirementsMet("")).toBe(true);
  });

  it("makes a variant a sub-species that stands in for a race of the pack", () => {
    const sub = byId(result, "imp1:subspecies/dune-wanderer");
    expect(sub.parent).toBe("imp1:species/dune-race");
    expect(sub.data.replacesSpecies).toBe(true);
    // The race without what the variant replaces (the strength and the old trick), plus its own.
    expect(sub.effects).toEqual([
      { type: "abilityBonus", ability: "con", value: 1 },
      { type: "abilityBonus", ability: "dex", value: 2 },
      { type: "trait", id: "imp1:trait/new-trick" },
    ]);
    // The race itself is unchanged.
    expect(byId(result, "imp1:species/dune-race").effects).toEqual([
      { type: "abilityBonus", ability: "str", value: 2 },
      { type: "abilityBonus", ability: "con", value: 1 },
      { type: "trait", id: "imp1:trait/old-trick" },
    ]);
  });

  it("takes from the app's own race what a variant replaces", () => {
    const sub = byId(result, "imp1:subspecies/scholar-dwarf");
    expect(sub.parent).toBe("srd51:species/dwarf");
    const bonuses = sub.effects.flatMap((e) => (e.type === "abilityBonus" ? [e] : []));
    expect(bonuses).toEqual([{ type: "abilityBonus", ability: "int", value: 2 }]);
    // The rest of the dwarf stays (languages, traits).
    expect(sub.effects.some((e) => e.type === "trait")).toBe(true);
  });

  it("does not report definitions as unsupported", () => {
    expect(result.skipped).toEqual({});
  });
});
