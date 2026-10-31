// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { itemData } from "../../data/items";
import { classData, subclassData } from "../../data/progression";
import { type Entry, parsePack } from "../../data/schema";
import { createCharacter } from "../../engine/character";
import { collectEffects } from "../../engine/choices";
import { deriveSheet, indexPacks } from "../../engine/derive";
import { plainEffects } from "../../engine/requirements";
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
    expect(plainEffects(cls.effects)).toEqual(
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

  it("lets Hex Warrior and Battle Ready make a weapon use another ability", () => {
    const features = wrap(`
      <element name="The Hexblade" type="Archetype" source="Test Book" id="ID_H">
        <supports>Otherworldly Patron</supports>
        <description><p>A pact with a sentient weapon.</p></description>
        <rules><grant type="Archetype Feature" id="ID_WOTC_XGTE_ARCHETYPE_FEATURE_HEXBLADE_HEX_WARRIOR" level="1" /></rules>
      </element>
      <element name="Hex Warrior" type="Archetype Feature" source="Test Book" id="ID_WOTC_XGTE_ARCHETYPE_FEATURE_HEXBLADE_HEX_WARRIOR">
        <supports>Warlock</supports>
        <description><p>Use Charisma.</p></description>
        <rules><stat name="hex warrior:attack" value="charisma:modifier" bonus="ability" /></rules>
      </element>
      <element name="Battle Smith" type="Archetype" source="Test Book" id="ID_B">
        <supports>Martial Archetype</supports>
        <description><p>A smith.</p></description>
        <rules><grant type="Archetype Feature" id="ID_WOTC_ERLW_ARCHETYPE_FEATURE_BATTLE_SMITH_BATTLE_READY" level="3" /></rules>
      </element>
      <element name="Battle Ready" type="Archetype Feature" source="Test Book" id="ID_WOTC_ERLW_ARCHETYPE_FEATURE_BATTLE_SMITH_BATTLE_READY">
        <supports>Fighter</supports>
        <description><p>Use Intelligence.</p></description>
      </element>`);
    const made = parseAurora([features], options);
    expect(byId(made, "imp1:feature/hex-warrior").effects).toContainEqual({
      type: "weaponAbility",
      ability: "cha",
      when: "oneHanded",
      proficient: true,
    });
    expect(byId(made, "imp1:feature/battle-ready").effects).toContainEqual({
      type: "weaponAbility",
      ability: "int",
      when: "magic",
    });
  });

  it("lets a sub-race that sets a flag replace what the race gives unless it is there", () => {
    const set = wrap(`
      <element name="Fiendish" type="Race" source="Test Book" id="ID_T_FIENDISH">
        <description><p>A people.</p></description>
        <rules>
          <stat name="intelligence" value="1" requirements="!ID_T_FLAG" />
          <stat name="charisma" value="2" requirements="!ID_T_FLAG" />
          <select type="Sub Race" name="Line" supports="Fiendish" optional="true" />
        </rules>
      </element>
      <element name="Line Flag" type="Grants" source="Test Book" id="ID_T_FLAG" />
      <element name="Fiendish (Infernal)" type="Sub Race" source="Test Book" id="ID_T_INFERNAL">
        <supports>Fiendish</supports>
        <description><p>Its own increases.</p></description>
        <rules>
          <grant type="Grants" id="ID_T_FLAG" />
          <stat name="charisma" value="2" />
          <stat name="constitution" value="1" />
        </rules>
      </element>
      <element name="Fiendish (Plain)" type="Sub Race" source="Test Book" id="ID_T_PLAIN">
        <supports>Fiendish</supports>
        <description><p>Adds to the race.</p></description>
        <rules><stat name="wisdom" value="1" /></rules>
      </element>`);
    const made = parseAurora([set], options);
    // The race keeps its increases behind the requirement, and the sub-race sets the flag.
    const fiendish = byId(made, "imp1:species/fiendish");
    expect(fiendish.effects).toEqual([
      {
        type: "when",
        requires: "!ID_T_FLAG",
        effects: [
          { type: "abilityBonus", ability: "int", value: 1 },
          { type: "abilityBonus", ability: "cha", value: 2 },
        ],
      },
    ]);
    const infernal = byId(made, "imp1:subspecies/fiendish-infernal");
    expect(infernal.data.replacesSpecies).toBeUndefined();
    expect(infernal.effects).toContainEqual({ type: "flag", id: "ID_T_FLAG" });

    // Chosen together, the sheet gets the ones that hold: the sub-race's, and not the race's.
    const index = new Map(made.entries.map((e) => [e.id, e]));
    const bonuses = (...ids: string[]) =>
      collectEffects(
        ids.flatMap((id) => index.get(id) ?? []),
        { index, selections: {}, warnings: [] },
      )
        .effects.flatMap((e) => (e.type === "abilityBonus" ? [e.ability + e.value] : []))
        .sort();
    expect(bonuses("imp1:species/fiendish")).toEqual(["cha2", "int1"]);
    expect(bonuses("imp1:species/fiendish", infernal.id)).toEqual(["cha2", "con1"]);
    expect(bonuses("imp1:species/fiendish", "imp1:subspecies/fiendish-plain")).toEqual([
      "cha2",
      "int1",
      "wis1",
    ]);
  });

  it("reads other speeds and senses, and a bonus to the speed that moves all of them", () => {
    const set = wrap(`
      <element name="Skyfolk" type="Race" source="Test Book" id="ID_T_SKY">
        <description><p>Winged.</p></description>
        <rules>
          <stat name="innate speed" value="30" bonus="base" />
          <stat name="innate speed:fly" value="innate speed" bonus="base" equipped="![armor:heavy]" />
          <stat name="innate speed:swim" value="40" bonus="base" />
          <stat name="innate speed:burrow" value="monk:level" bonus="base" />
          <stat name="darkvision:range" value="60" bonus="base" />
          <stat name="innate speed:misc" value="10" equipped="![armor:heavy]" />
          <stat name="innate speed:swim:misc" value="10" equipped="![armor:heavy]" requirements="[innate speed:swim:1]" />
          <stat name="innate speed:climb:misc" value="5" requirements="[innate speed:climb:1]" />
        </rules>
      </element>`);
    const made = parseAurora([set], options);
    expect(byId(made, "imp1:species/skyfolk").effects).toEqual([
      { type: "movement", mode: "fly", feet: "walk", when: "noHeavyArmor" },
      { type: "movement", mode: "swim", feet: 40 },
      { type: "sense", sense: "darkvision", range: 60 },
      { type: "modifier", target: "speed", value: 10, when: "noHeavyArmor" },
    ]);
    // The speed that depends on a number the app cannot work out, and a bonus nothing else gives, are left out.
    expect(made.unsupportedBy.ID_T_SKY).toBe(2);
  });

  it("reads bonuses to initiative, armor class, hit points and the spell attack and save DC", () => {
    const set = wrap(`
      <element name="Lucky Trait" type="Racial Trait" source="Test Book" id="ID_T_LUCKY">
        <description><p>Alert.</p></description>
        <rules>
          <stat name="initiative" value="5" />
          <stat name="initiative" value="proficiency" />
          <stat name="ac:misc" value="charisma:modifier" equipped="[armor:none]" />
          <stat name="ac:misc" value="1" equipped="[shield:none]" />
          <stat name="hp" value="level:sorcerer" />
          <stat name="hp" value="40" />
          <stat name="spellcasting:attack" value="2" />
          <stat name="spellcasting:dc" value="2" alt="Other Form" />
        </rules>
      </element>
      <element name="Luckfolk" type="Race" source="Test Book" id="ID_T_LUCKFOLK">
        <description><p>Lucky.</p></description>
        <rules><grant type="Racial Trait" id="ID_T_LUCKY" /></rules>
      </element>`);
    const made = parseAurora([set], options);
    expect(byId(made, "imp1:trait/lucky-trait").effects).toEqual([
      { type: "modifier", target: "initiative", value: 5 },
      { type: "modifier", target: "initiative", value: 0, plus: "proficiency" },
      { type: "modifier", target: "ac", value: 0, plus: "cha", when: "unarmored" },
      { type: "modifier", target: "hpPerLevel", value: 1 },
      { type: "modifier", target: "hp", value: 40 },
      { type: "modifier", target: "spellAttack", value: 2 },
    ]);
    // What depends on a shield, and a variant of an item, are left out.
    expect(made.unsupportedBy.ID_T_LUCKY).toBe(2);
  });

  it("offers the proficiencies a select asks for by their tags, and reads expertise and the senses of a vision", () => {
    const set = wrap(`
      <element name="Tool Proficiency (Thieves' tools)" type="Proficiency" source="Test Book" id="ID_PROFICIENCY_TOOL_PROFICIENCY_THIEVES_TOOLS">
        <supports>Tool, Thieves tools</supports>
        <description><p>Locks.</p></description>
      </element>
      <element name="Weapon Proficiency (Dagger)" type="Proficiency" source="Test Book" id="ID_PROFICIENCY_WEAPON_PROFICIENCY_DAGGER">
        <supports>Weapon, Simple</supports>
        <description><p>Stabs.</p></description>
      </element>
      <element name="Weapon Proficiency (Longsword)" type="Proficiency" source="Test Book" id="ID_PROFICIENCY_WEAPON_PROFICIENCY_LONGSWORD">
        <supports>Weapon, Martial</supports>
        <description><p>Slashes.</p></description>
      </element>
      <element name="Sharp Trait" type="Racial Trait" source="Test Book" id="ID_T_SHARP">
        <description><p>Sharp.</p></description>
        <rules>
          <select type="Proficiency" name="Training" supports="Simple||Tool" number="1" />
          <grant type="Proficiency" id="ID_INTERNAL_PROFICIENCY_SKILL_EXPERTISE_STEALTH" />
          <grant type="Vision" id="ID_VISION_SUPERIORDARKVISION" />
          <stat name="darkvision:range" value="120" bonus="base" />
          <grant type="Vision" id="ID_VISION_BLINDSIGHT" />
        </rules>
      </element>
      <element name="Sharpfolk" type="Race" source="Test Book" id="ID_T_SHARPFOLK">
        <description><p>Sharp.</p></description>
        <rules><grant type="Racial Trait" id="ID_T_SHARP" /></rules>
      </element>`);
    const made = parseAurora([set], options);
    const effects = byId(made, "imp1:trait/sharp-trait").effects;
    expect(effects).toContainEqual({ type: "expertise", skill: "stealth" });
    expect(effects).toContainEqual({ type: "sense", sense: "darkvision", range: 120 });
    const training = effects.find((e) => e.type === "choice" && e.grants === "proficiency");
    expect(training?.type === "choice" && [...training.from].sort()).toEqual([
      "tool:thieves-tools",
      "weapon:daggers",
    ]);
    // A vision without a range stat of its own (the blindsight here) cannot be applied.
    expect(made.unsupportedBy.ID_T_SHARP).toBe(1);
  });

  it("reads armor class formulas written without base and ability, attunement and bonuses to skills", () => {
    const set = wrap(`
      <element name="Plated Robe" type="Magic Item" source="Test Book" id="ID_T_ROBE">
        <description><p>Armor.</p></description>
        <setters><set name="category">Wondrous Items</set><set name="rarity">Rare</set></setters>
        <rules>
          <stat name="ac:plated robe" value="15" />
          <stat name="ac:plated robe" value="dexterity:modifier" />
          <stat name="ac:calculation" value="ac:plated robe" bonus="calculation" equipped="[armor:none]" />
          <stat name="sleight of hand:misc" value="5" />
          <stat name="stealth:misc" value="2" equipped="[shield:none]" />
        </rules>
      </element>
      <element name="Lucky Gem" type="Magic Item" source="Test Book" id="ID_T_GEM">
        <description><p>Luck.</p></description>
        <setters><set name="category">Wondrous Items</set><set name="rarity">Rare</set></setters>
        <rules>
          <stat name="acrobatics:misc" value="1" />
          <stat name="animal handling:misc" value="1" />
          <stat name="arcana:misc" value="1" />
          <stat name="athletics:misc" value="1" />
          <stat name="deception:misc" value="1" />
          <stat name="history:misc" value="1" />
          <stat name="insight:misc" value="1" />
          <stat name="intimidation:misc" value="1" />
          <stat name="investigation:misc" value="1" />
          <stat name="medicine:misc" value="1" />
          <stat name="nature:misc" value="1" />
          <stat name="perception:misc" value="1" />
          <stat name="performance:misc" value="1" />
          <stat name="persuasion:misc" value="1" />
          <stat name="religion:misc" value="1" />
          <stat name="sleight of hand:misc" value="1" />
          <stat name="stealth:misc" value="1" />
          <stat name="survival:misc" value="1" />
        </rules>
      </element>
      <element name="Mind Gift" type="Racial Trait" source="Test Book" id="ID_T_GIFT">
        <description><p>Attune.</p></description>
        <rules>
          <stat name="attunement:max" value="4" bonus="base" />
          <select type="Ability Score Improvement" name="Improvement" supports="Ability Score Improvement,Class" />
        </rules>
      </element>
      <element name="Mindfolk" type="Race" source="Test Book" id="ID_T_MINDFOLK">
        <description><p>Minds.</p></description>
        <rules><grant type="Racial Trait" id="ID_T_GIFT" /></rules>
      </element>`);
    const made = parseAurora([set], options);
    expect(byId(made, "imp1:item/plated-robe").effects).toEqual([
      { type: "unarmoredDefense", base: 15, add: [], shield: true },
      { type: "modifier", target: "skill", value: 5, skill: "sleight-of-hand" },
    ]);
    // The skill bonus that needs a shield not to be carried is left out.
    expect(made.unsupportedBy.ID_T_ROBE).toBe(1);
    expect(byId(made, "imp1:item/lucky-gem").effects).toEqual([
      { type: "modifier", target: "skill", value: 1 },
    ]);
    expect(byId(made, "imp1:trait/mind-gift").effects).toEqual([
      { type: "attunementMax", value: 4 },
    ]);
    expect(made.unsupportedBy.ID_T_GIFT).toBeUndefined();
  });

  it("takes the race that offers a sub-race as its parent when two races are the same one of the app", () => {
    const set = wrap(`
      <element name="Dwarf" type="Race" source="New Rules" id="ID_T_DWARF_NEW">
        <description><p>Without increases.</p></description>
        <rules><stat name="innate speed" value="25" bonus="base"/></rules>
      </element>
      <element name="Dwarf" type="Race" source="Old Rules" id="ID_T_DWARF_OLD">
        <description><p>With increases.</p></description>
        <rules>
          <stat name="constitution" value="2" requirements="!ID_T_LINE" />
          <select type="Sub Race" name="Line" supports="Dwarf" optional="true" />
        </rules>
      </element>
      <element name="Line Flag" type="Grants" source="Test Book" id="ID_T_LINE" />
      <element name="Dwarf (Deep)" type="Sub Race" source="Old Rules" id="ID_T_DEEP">
        <supports>Dwarf</supports>
        <description><p>Its own.</p></description>
        <rules>
          <grant type="Grants" id="ID_T_LINE" />
          <stat name="strength" value="1" />
        </rules>
      </element>`);
    const made = parseAurora([set], options);
    const deep = byId(made, "imp1:subspecies/dwarf-deep");
    expect(deep.parent).toBe("srd51:species/dwarf");
    // It only adds, and sets the flag that the right race, the second one, tests for.
    expect(deep.data.replacesSpecies).toBeUndefined();
    expect(deep.effects).toEqual([
      { type: "flag", id: "ID_T_DEEP" },
      { type: "flag", id: "ID_T_LINE" },
      { type: "abilityBonus", ability: "str", value: 1 },
    ]);
  });

  it("lets an option of one pack switch rules of another, which ask for it by its Aurora id", () => {
    const folk = wrap(`
      <element name="Plain Folk" type="Race" source="Core" id="ID_T_PLAIN_FOLK">
        <description><p>Fixed.</p></description>
        <rules>
          <stat name="strength" value="2" requirements="!ID_T_OPT_FREE" />
          <select type="Ability Score Improvement" name="Free" supports="Custom Ability Score Increase 2" requirements="ID_T_OPT_FREE" />
        </rules>
      </element>`);
    const extras = wrap(`
      <element name="Free Origin" type="Option" source="Extras" id="ID_T_OPT_FREE">
        <description><p>Choose your own.</p></description>
      </element>
      <element name="Extra Folk" type="Race" source="Extras" id="ID_T_EXTRA_FOLK">
        <description><p>Also fixed.</p></description>
        <rules><stat name="dexterity" value="2" requirements="!ID_T_OPT_FREE" /></rules>
      </element>`);
    const core = parseAurora([folk], { ...options, packId: "impa" });
    const more = parseAurora([extras], { ...options, packId: "impb" });
    const option = byId(more, "impb:option/free-origin");
    expect(option.effects).toContainEqual({ type: "flag", id: "ID_T_OPT_FREE" });
    const index = new Map([
      ...srd51Index,
      ...[...core.entries, ...more.entries].map((e): [string, Entry] => [e.id, e]),
    ]);
    const strength = (on: boolean) => {
      const c = createCharacter("srd51");
      c.choices.species = "impa:species/plain-folk";
      c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
      if (on) c.options = [option.id];
      return deriveSheet(c, index);
    };
    expect(strength(false).abilities.str.bonus).toBe(2);
    const on = strength(true);
    expect(on.abilities.str.bonus).toBe(0);
    expect(on.choices.filter((p) => p.grants === "abilityBonus")).toHaveLength(1);
  });

  it("merges a spell reprinted with other punctuation and with more classes, keeping all the classes", () => {
    const spell = (book: string, aid: string, ending: string, classes: string) => `
      <element name="Mold Dust" type="Spell" source="${book}" id="${aid}">
        <supports>${classes}</supports>
        <description><p>You shape the dust in one of the following ways${ending}</p></description>
        <setters><set name="level">0</set><set name="school">Transmutation</set></setters>
      </element>`;
    const made = parseAurora(
      [
        wrap(
          spell("First Book", "ID_T_DUST_1", ":", "Wizard") +
            spell("Second Book", "ID_T_DUST_2", ".", "Wizard, Sorcerer"),
        ),
      ],
      options,
    );
    const dust = made.entries.filter((e) => e.kind === "spell" && /mold-dust/.test(e.id));
    expect(dust).toHaveLength(1);
    expect(dust[0]?.data.classes).toEqual(
      expect.arrayContaining(["srd51:class/wizard", "srd51:class/sorcerer"]),
    );
  });

  it("grants the spells of a trait from their level, also when the spells are in other files", () => {
    const set = wrap(`
      <element name="Legacy of Dis" type="Racial Trait" source="Test Book" id="ID_T_LEGACY">
        <description><p>You know a cantrip, and more later.</p></description>
        <rules>
          <grant type="Spell" id="ID_PHB_SPELL_THAUMATURGY" />
          <grant type="Spell" id="ID_PHB_SPELL_DISGUISE_SELF" level="3" />
          <grant type="Spell" id="ID_PHB_SPELL_NO_SUCH_THING" level="5" />
        </rules>
      </element>
      <element name="Dis Folk" type="Race" source="Test Book" id="ID_T_DIS_FOLK">
        <description><p>Of Dis.</p></description>
        <rules><grant type="Racial Trait" id="ID_T_LEGACY" /></rules>
      </element>`);
    const made = parseAurora([set], options);
    expect(byId(made, "imp1:trait/legacy-of-dis").effects).toEqual([
      { type: "grantSpell", spell: "srd51:spell/thaumaturgy" },
      { type: "grantSpell", spell: "srd51:spell/disguise-self", minLevel: 3 },
    ]);
  });

  it("gives entries that share a name the same ids whatever the order or the rest of the files", () => {
    const named = (aid: string, text: string) => `
      <element name="Charisma" type="Racial Trait" source="Book" id="${aid}">
        <description><p>${text}</p></description>
      </element>`;
    const race = (traits: string[]) => `
      <element name="Folk" type="Race" source="Book" id="ID_T_FOLK">
        <description><p>Folk.</p></description>
        <rules>${traits.map((t) => `<grant type="Racial Trait" id="${t}" />`).join("")}</rules>
      </element>`;
    const a = named("ID_T_A_CHA", "First.");
    const b = named("ID_T_B_CHA", "Second.");
    const idsOf = (xml: string[]) => {
      const made = parseAurora([wrap(xml.join(""))], options);
      return Object.fromEntries(Object.entries(made.aids).filter(([aid]) => aid.endsWith("_CHA")));
    };
    const together = idsOf([race(["ID_T_B_CHA", "ID_T_A_CHA"]), b, a]);
    expect(together).toEqual({
      ID_T_A_CHA: "imp1:trait/charisma",
      ID_T_B_CHA: "imp1:trait/charisma-2",
    });
    // Another order of the files, and one more element of the same name that nothing grants.
    expect(idsOf([race(["ID_T_A_CHA", "ID_T_B_CHA"]), a, b])).toEqual(together);
    const more = named("ID_T_0_CHA", "Zeroth.");
    const withMore = idsOf([race(["ID_T_B_CHA", "ID_T_A_CHA"]), b, a, more]);
    // The one that comes first by its Aurora id takes the plain name; the others keep their order.
    expect(withMore.ID_T_B_CHA).toBe("imp1:trait/charisma-3");
  });

  it("puts a space after a label written as a span, which the files leave out", () => {
    const set = wrap(`
      <element name="Labelled" type="Background" source="Test Book" id="ID_T_LABELLED">
        <description>
          <p>
            <span class="feature">Speed.</span>You move fast.
            <span class="feature">Eyes.</span>You see well.
          </p>
        </description>
      </element>`);
    const made = parseAurora([set], options);
    expect(made.strings["imp1:background/labelled.desc"]).toBe(
      "Speed. You move fast. Eyes. You see well.",
    );
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
  <element name="Weapon, +2" type="Magic Item" source="Test Book" id="ID_L_MAGIC_WEAPON_2">
    <description><p>You have a +2 bonus to attack and damage rolls made with this magic weapon.</p></description>
    <setters>
      <set name="category">Magic Weapons</set>
      <set name="type" addition="any">Weapon</set>
      <set name="rarity">Rare</set>
      <set name="enhancement">2</set>
      <set name="weapon">ID_INTERNAL_WEAPON_CATEGORY_SIMPLE_MELEE||ID_INTERNAL_WEAPON_CATEGORY_MARTIAL_MELEE</set>
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
  <element name="Ring of Warding" type="Magic Item" source="Test Book" id="ID_L_MAGIC_WARD">
    <description><p>Wards you.</p></description>
    <setters><set name="category">Rings</set><set name="type">Ring</set><set name="rarity">Rare</set><set name="attunement">true</set></setters>
    <rules>
      <stat name="ac:misc" value="1" />
      <stat name="strength:save:misc" value="1" />
      <stat name="dexterity:save:misc" value="1" />
      <stat name="constitution:save:misc" value="1" />
      <stat name="intelligence:save:misc" value="1" />
      <stat name="wisdom:save:misc" value="1" />
      <stat name="charisma:save:misc" value="1" />
      <grant type="Condition" id="ID_INTERNAL_CONDITION_DAMAGE_RESISTANCE_FIRE" />
      <stat name="spellcasting:attack" value="2" />
    </rules>
  </element>
  <element name="Belt of Might" type="Magic Item" source="Test Book" id="ID_L_MAGIC_BELT">
    <description><p>Strong.</p></description>
    <setters><set name="category">Wondrous Items</set><set name="type">Wondrous Item</set><set name="rarity">Rare</set></setters>
    <rules>
      <stat name="strength:score:set" value="21" bonus="base" />
      <stat name="ac:armored:enhancement" value="1" bonus="enhancement" />
      <stat name="ac:shield" value="2" bonus="enhancement" />
      <stat name="intelligence" value="1" />
    </rules>
  </element>
  <element name="Echo Bolt" type="Spell" source="Test Book" id="ID_R_SPELL_ECHO_1">
    <supports>Wizard</supports>
    <description><p>A bolt of sound.</p></description>
    <setters><set name="level">0</set><set name="school">Evocation</set></setters>
  </element>
  <element name="Echo Bolt" type="Spell" source="Another Book" id="ID_R_SPELL_ECHO_2">
    <supports>Wizard</supports>
    <description><p>A  bolt of  sound.</p></description>
    <setters><set name="level">0</set><set name="school">Evocation</set></setters>
  </element>
  <element name="Edge Bolt" type="Spell" source="Test Book" id="ID_R_SPELL_EDGE_1">
    <supports>Wizard</supports>
    <description><p>A bolt of edges.</p></description>
    <setters><set name="level">0</set><set name="school">Evocation</set></setters>
  </element>
  <element name="Edge Bolt" type="Spell" source="Another Book" id="ID_R_SPELL_EDGE_2">
    <supports>Wizard</supports>
    <description><p>A bolt of sharper edges.</p></description>
    <setters><set name="level">0</set><set name="school">Evocation</set></setters>
  </element>
  <element name="Reborn Bolt" type="Spell" source="Test Book" id="ID_R_SPELL_REBORN_OLD">
    <supports>Wizard</supports>
    <description><p>The old words.</p></description>
    <setters><set name="level">1</set><set name="school">Evocation</set></setters>
  </element>
  <element name="Reborn Bolt" type="Spell" source="Test Book (2024)" id="ID_R_SPELL_REBORN_NEW">
    <supports>Wizard</supports>
    <description><p>The new words.</p></description>
    <setters><set name="level">1</set><set name="school">Evocation</set></setters>
  </element>
  <element name="Brand New Bolt" type="Spell" source="Test Book (2024)" id="ID_R_SPELL_BRANDNEW">
    <supports>Wizard</supports>
    <description><p>Only in the new book.</p></description>
    <setters><set name="level">1</set><set name="school">Evocation</set></setters>
  </element>
  <element name="Many Times" type="Feat" source="Test Book" id="ID_R_FEAT_MANY">
    <requirements>[character:4]</requirements>
    <description><p>You can take this again.</p></description>
  </element>
  <element name="Many Times" type="Feat" source="Test Book" id="ID_R_FEAT_MANY_2">
    <requirements>ID_R_FEAT_MANY</requirements>
    <description><p>You can take this again.</p></description>
  </element>
  <element name="Echo Folk" type="Race" source="Test Book" id="ID_R_RACE_ECHO">
    <description><p>They hear things.</p></description>
    <rules><grant type="Spell" id="ID_R_SPELL_ECHO_2" /></rules>
  </element>
  <element name="Feat Unlocker" type="Item" source="Test Book" id="ID_R_ITEM_UNLOCKER">
    <description><p>Bookkeeping.</p></description>
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

  it("imports a magic weapon as an enchantment that gives a bonus", () => {
    const weapon = byId(result, "imp1:item/weapon-2");
    expect(weapon.data).toMatchObject({ rarity: "rare", enchants: true, enhancement: 2 });
    const ring = byId(result, "imp1:item/ring-of-testing");
    expect(ring.data.enchants).toBeUndefined();
    expect(ring.data.enhancement).toBeUndefined();
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
    const choice = {
      type: "choice",
      choose: 1,
      grants: "abilityBonus",
      from: ["str", "dex", "con", "int", "wis", "cha"],
    };
    // Each is behind its requirement: the +2 unless a background gives the increases, the other
    // only when something says so.
    expect(race.effects).toEqual([
      {
        type: "when",
        requires: "!ID_INTERNAL_GRANTS_BACKGROUND_ASI",
        effects: [{ ...choice, id: "species-1", value: 2 }],
      },
      {
        type: "when",
        requires: "ID_OPTION_NEVER_HELD",
        effects: [{ ...choice, id: "species-2", value: 1 }],
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

  it("makes a variant of a race of the pack a sub-species that sets the flag the race tests", () => {
    const sub = byId(result, "imp1:subspecies/dune-wanderer");
    expect(sub.parent).toBe("imp1:species/dune-race");
    expect(sub.data.replacesSpecies).toBeUndefined();
    expect(sub.effects).toEqual([
      { type: "flag", id: "ID_V_VARIANT" },
      { type: "flag", id: "ID_V_FLAG" },
      { type: "abilityBonus", ability: "dex", value: 2 },
      { type: "trait", id: "imp1:trait/new-trick" },
    ]);
    // The race keeps what the variant replaces (the strength and the old trick) behind a `when`.
    expect(byId(result, "imp1:species/dune-race").effects).toEqual([
      {
        type: "when",
        requires: "!(ID_V_FLAG||ID_V_OTHER)",
        effects: [{ type: "abilityBonus", ability: "str", value: 2 }],
      },
      { type: "abilityBonus", ability: "con", value: 1 },
      {
        type: "when",
        requires: "!ID_V_FLAG",
        effects: [{ type: "trait", id: "imp1:trait/old-trick" }],
      },
    ]);
    // Chosen together, the sheet has the race without those and the variant's own.
    const index = new Map(result.entries.map((e) => [e.id, e]));
    const traits = (...ids: string[]) =>
      collectEffects(
        ids.flatMap((id) => index.get(id) ?? []),
        { index, selections: {}, warnings: [] },
      ).effects.flatMap((e) => (e.type === "trait" ? [e.id] : []));
    expect(traits("imp1:species/dune-race")).toEqual(["imp1:trait/old-trick"]);
    expect(traits("imp1:species/dune-race", sub.id)).toEqual(["imp1:trait/new-trick"]);
  });

  it("makes a variant of the app's own race an addition that sets its flag", () => {
    const sub = byId(result, "imp1:subspecies/scholar-dwarf");
    expect(sub.parent).toBe("srd51:species/dwarf");
    expect(sub.data.replacesSpecies).toBeUndefined();
    expect(sub.effects).toEqual([
      { type: "flag", id: "ID_V_SCHOLAR" },
      { type: "flag", id: "ID_V_FLAG2" },
      { type: "abilityBonus", ability: "int", value: 2 },
    ]);
  });

  it("reads what a magic item gives as effects", () => {
    expect(byId(result, "imp1:item/ring-of-warding").effects).toEqual([
      { type: "modifier", target: "ac", value: 1 },
      { type: "defense", kind: "resistance", damage: "fire" },
      { type: "modifier", target: "spellAttack", value: 2 },
      { type: "modifier", target: "save", value: 1 },
    ]);
    expect(byId(result, "imp1:item/belt-of-might").effects).toEqual([
      { type: "abilityFloor", ability: "str", value: 21 },
      { type: "modifier", target: "ac", value: 1, when: "wearingArmor" },
      { type: "modifier", target: "ac", value: 2, when: "wearingShield" },
      { type: "abilityBonus", ability: "int", value: 1 },
    ]);
    expect(byId(result, "imp1:item/ring-of-warding").data.attunement).toBe(true);
  });

  it("merges entries that say exactly the same and points what referred to them at the one kept", () => {
    const echoes = result.entries.filter((e) =>
      result.strings[`${e.id}.name`]?.startsWith("Echo Bolt"),
    );
    expect(echoes.map((e) => e.id)).toEqual(["imp1:spell/echo-bolt"]);
    expect(byId(result, "imp1:species/echo-folk").effects).toEqual([
      { type: "grantSpell", spell: "imp1:spell/echo-bolt" },
    ]);
    // A feat written as copies that ask for the one before is one feat.
    expect(result.entries.filter((e) => e.id.startsWith("imp1:feat/many-times"))).toHaveLength(1);
    expect(result.merged).toBeGreaterThanOrEqual(2);
  });

  it("keeps two versions that differ in a word, with the book to tell them apart", () => {
    const edges = result.entries.filter((e) => e.id.startsWith("imp1:spell/edge-bolt"));
    expect(edges).toHaveLength(2);
    expect(edges.map((e) => result.strings[`${e.id}.name`]).sort()).toEqual([
      "Edge Bolt (Another Book)",
      "Edge Bolt (Test Book)",
    ]);
  });

  it("uses the 2014 version when a 2024 one exists, and keeps what is only in 2024", () => {
    const reborn = result.entries.filter((e) =>
      result.strings[`${e.id}.name`]?.startsWith("Reborn"),
    );
    expect(reborn).toHaveLength(1);
    expect(result.strings[`${reborn[0]?.id}.desc`]).toBe("The old words.");
    expect(result.editions).toBe(1);
    expect(result.entries.some((e) => result.strings[`${e.id}.name`] === "Brand New Bolt")).toBe(
      true,
    );

    const both = parseAurora([LEGACY], { ...options, keepEditions: true });
    expect(
      both.entries.filter((e) => both.strings[`${e.id}.name`]?.startsWith("Reborn")),
    ).toHaveLength(2);
    expect(both.editions).toBe(0);
  });

  it("leaves out the items Aurora keeps for its own books", () => {
    expect(result.entries.some((e) => result.strings[`${e.id}.name`] === "Feat Unlocker")).toBe(
      false,
    );
  });

  it("does not report definitions as unsupported", () => {
    expect(result.skipped).toEqual({});
  });
});
