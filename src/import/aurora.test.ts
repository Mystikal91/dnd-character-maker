// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { itemData } from "../data/items";
import { parsePack } from "../data/schema";
import { AuroraParseError, parseAurora, slugify } from "./aurora";

// Invented content in the shape of an Aurora file; nothing here comes from a real book.
const SPELLS = `<?xml version="1.0" encoding="utf-8" ?>
<elements>
  <info><name>Test Spells</name></info>
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
  <element name="Wanderer" type="Race" source="Test Book" id="ID_TEST_RACE_WANDERER">
    <description><p>Not supported yet.</p></description>
  </element>
</elements>`;

const ITEMS = `<elements>
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
  </element>
</elements>`;

const known = new Set([
  "srd51:class/wizard",
  "srd51:class/cleric",
  "srd51:property/thrown",
  "srd51:property/versatile",
  "srd51:property/ammunition",
  "srd51:property/two-handed",
]);
const options = { packId: "imp1", known };

describe("slugify", () => {
  it("makes ids the pack schema accepts", () => {
    expect(slugify("Tasha’s Cauldron")).toBe("tashas-cauldron");
    expect(slugify("  Épée Longue!! ")).toBe("epee-longue");
  });
});

describe("parseAurora spells", () => {
  const result = parseAurora([SPELLS], options);
  const glimmer = result.entries.find((e) => e.id === "imp1:spell/glimmer");

  it("reads a spell's facts and texts", () => {
    expect(glimmer?.data).toEqual({
      level: 1,
      school: "evocation",
      components: ["V", "M"],
      ritual: false,
      concentration: true,
      classes: ["srd51:class/wizard"], // Artificer is not in the app
    });
    expect(result.strings["imp1:spell/glimmer.name"]).toBe("Glimmer");
    expect(result.strings["imp1:spell/glimmer.desc"]).toBe(
      "A small light appears at a point you choose.",
    );
    expect(result.strings["imp1:spell/glimmer.higherLevel"]).toBe("The light grows brighter.");
    expect(result.strings["imp1:spell/glimmer.castingTime"]).toBe("1 action");
    expect(result.strings["imp1:spell/glimmer.material"]).toBe("a firefly");
  });

  it("gives equal names their own ids", () => {
    expect(result.entries.map((e) => e.id)).toEqual(["imp1:spell/glimmer", "imp1:spell/glimmer-2"]);
  });

  it("counts what it cannot import and names the sources", () => {
    expect(result.skipped).toEqual({ Race: 1 });
    expect(result.sources).toEqual(["Test Book"]);
    expect(result.title).toBe("Test Spells");
  });
});

describe("parseAurora items", () => {
  const result = parseAurora([ITEMS], options);
  const entry = (slug: string) => {
    const found = result.entries.find((e) => e.id === `imp1:item/${slug}`);
    if (!found) throw new Error(`missing ${slug}`);
    return itemData(found);
  };

  it("reads a melee weapon with a thrown range and a versatile die", () => {
    expect(entry("test-spear")).toMatchObject({
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
        proficiency: ["weapon:simple-weapons"],
      },
    });
  });

  it("reads a ranged weapon and converts platinum to gold", () => {
    expect(entry("test-bow")).toMatchObject({
      cost: { amount: 20, unit: "gp" },
      weapon: { category: "martial", kind: "ranged", range: { normal: 150, long: 600 } },
    });
  });

  it("reads armor class, dexterity limits, strength and stealth", () => {
    expect(entry("test-mail").armor).toEqual({
      category: "medium",
      base: 13,
      dexBonus: true,
      maxDexBonus: 2,
      strengthMinimum: 13,
      stealthDisadvantage: true,
      proficiency: ["armor:medium-armor"],
    });
    expect(entry("test-plate")).toMatchObject({
      cost: { amount: 1500, unit: "gp" },
      armor: { category: "heavy", base: 18, dexBonus: false, strengthMinimum: 0 },
    });
  });

  it("converts electrum for gear and reads languages", () => {
    expect(entry("rope-thing")).toMatchObject({
      category: "adventuring-gear",
      cost: { amount: 5, unit: "sp" },
      weight: 10,
    });
    expect(result.strings["imp1:language/old-tongue.speakers"]).toBe("Scholars");
    expect(result.strings["imp1:language/old-tongue.script"]).toBe("Runic");
  });

  it("makes a pack that passes the pack schema", () => {
    const pack = parsePack({
      manifest: {
        id: "imp1",
        ruleset: "custom",
        version: "1",
        license: "Personal",
        attribution: "x",
      },
      entries: [...parseAurora([SPELLS, ITEMS], options).entries],
    });
    expect(pack.entries).toHaveLength(8);
  });
});

describe("parseAurora options and errors", () => {
  it("leaves out what the app already has", () => {
    const result = parseAurora([SPELLS], {
      ...options,
      exists: (kind, name) => kind === "spell" && name === "Glimmer",
    });
    expect(result.entries).toHaveLength(0);
    expect(result.duplicates).toBe(2);
  });

  it("rejects text that is not an Aurora file", () => {
    expect(() => parseAurora(["not xml at all <<"], options)).toThrow(AuroraParseError);
    expect(() => parseAurora(["<other><x/></other>"], options)).toThrow(AuroraParseError);
  });
});
