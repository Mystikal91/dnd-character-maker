import { describe, expect, it } from "vitest";
import { type RawSource, cleanData, convertAll } from "./convert";

const ref = (index: string) => ({ index, name: index, url: `/api/2014/x/${index}` });

const raw: RawSource = {
  proficiencies: [
    {
      index: "skill-perception",
      name: "Skill: Perception",
      type: "Skills",
      reference: { index: "perception" },
    },
    {
      index: "battleaxes",
      name: "Battleaxes",
      type: "Weapons",
      reference: { index: "battleaxe" },
    },
  ],
  languages: [
    {
      index: "common",
      name: "Common",
      type: "Standard",
      typical_speakers: ["Humans"],
      script: "Common",
    },
    {
      index: "elvish",
      name: "Elvish",
      type: "Standard",
      typical_speakers: ["Elves"],
      script: "Elvish",
    },
  ],
  races: [
    {
      index: "elf",
      name: "Elf",
      speed: 30,
      size: "Medium",
      age: "old",
      alignment: "chaotic",
      size_description: "tall",
      language_desc: "speaks",
      ability_bonuses: [{ ability_score: ref("dex"), bonus: 2 }],
      languages: [ref("common")],
      traits: [ref("keen-senses")],
    },
  ],
  subraces: [],
  traits: [
    {
      index: "keen-senses",
      name: "Keen Senses",
      desc: ["First.", "Second."],
      proficiencies: [ref("skill-perception")],
    },
    {
      index: "dwarven-combat-training",
      name: "Dwarven Combat Training",
      desc: ["x"],
      proficiencies: [ref("battleaxes")],
    },
  ],
  backgrounds: [],
  spells: [],
  classes: [],
  subclasses: [],
  levels: [],
  features: [],
  equipment: [],
  weaponProperties: [],
  abilityScores: [],
  skills: [],
  magicSchools: [],
  conditions: [],
  alignments: [],
  monsters: [
    {
      index: "giant-eagle",
      name: "Giant Eagle",
      size: "Large",
      type: "beast",
      alignment: "neutral good",
      armor_class: [{ type: "dex", value: 13 }],
      hit_points: 26,
      hit_dice: "4d10",
      hit_points_roll: "4d10+4",
      speed: { walk: "10 ft.", fly: "80 ft." },
      strength: 16,
      dexterity: 17,
      constitution: 13,
      intelligence: 8,
      wisdom: 14,
      charisma: 10,
      proficiencies: [
        { value: 4, proficiency: { index: "skill-perception" } },
        { value: 2, proficiency: { index: "saving-throw-wis" } },
      ],
      damage_vulnerabilities: [],
      damage_resistances: ["fire"],
      damage_immunities: [],
      condition_immunities: [],
      senses: { passive_perception: 14, blindsight: "30 ft. (blind beyond this radius)" },
      languages: "Giant Eagle",
      challenge_rating: 1,
      proficiency_bonus: 2,
      xp: 200,
      special_abilities: [{ name: "Keen Sight", desc: "Advantage on sight checks." }],
      actions: [
        {
          name: "Multiattack",
          desc: "Two attacks.",
          multiattack_type: "actions",
          actions: [{ action_name: "Beak", count: 1, type: "melee" }],
        },
        {
          name: "Beak",
          desc: "Melee Weapon Attack.",
          attack_bonus: 5,
          damage: [{ damage_type: ref("piercing"), damage_dice: "1d6+3" }],
        },
      ],
    },
    {
      index: "swarm-of-bats",
      name: "Swarm of Bats",
      size: "Medium",
      type: "swarm of Tiny beasts",
      alignment: "unaligned",
      armor_class: [{ type: "dex", value: 12 }],
      hit_points: 22,
      hit_dice: "5d8",
      hit_points_roll: "5d8",
      speed: { walk: "0 ft.", fly: "30 ft." },
      strength: 5,
      dexterity: 15,
      constitution: 10,
      intelligence: 2,
      wisdom: 12,
      charisma: 4,
      proficiencies: [],
      damage_vulnerabilities: [],
      damage_resistances: [],
      damage_immunities: [],
      condition_immunities: [],
      senses: { passive_perception: 11 },
      languages: "",
      challenge_rating: 0.25,
      proficiency_bonus: 2,
      xp: 50,
    },
  ],
};

describe("cleanData", () => {
  it("drops urls and camel-cases keys, keeping numeric keys", () => {
    expect(cleanData({ damage_type: { index: "fire", url: "/x" }, at: { "3": "8d6" } })).toEqual({
      damageType: { index: "fire" },
      at: { "3": "8d6" },
    });
  });
});

describe("convertAll", () => {
  const out = convertAll(raw);

  it("maps species ability bonuses, languages and traits to effects", () => {
    expect(out.species.entries[0]).toMatchObject({
      id: "srd51:species/elf",
      data: { speed: 30, size: "medium" },
      effects: [
        { type: "abilityBonus", ability: "dex", value: 2 },
        { type: "proficiency", category: "language", target: "common" },
        { type: "trait", id: "srd51:trait/keen-senses" },
      ],
    });
  });

  it("resolves proficiency indexes into category and target", () => {
    const keen = out.trait.entries.find((e) => e.id === "srd51:trait/keen-senses");
    expect(keen?.effects).toEqual([
      { type: "proficiency", category: "skill", target: "perception" },
    ]);
    const dwarf = out.trait.entries.find((e) => e.id === "srd51:trait/dwarven-combat-training");
    expect(dwarf?.effects).toEqual([
      { type: "proficiency", category: "weapon", target: "battleaxes" },
    ]);
  });

  it("puts text in strings, joining paragraphs", () => {
    expect(out.trait.strings["keen-senses.desc"]).toBe("First.\n\nSecond.");
    expect(out.species.strings["elf.name"]).toBe("Elf");
  });

  it("fails loudly on unknown proficiencies", () => {
    const bad = {
      ...raw,
      traits: [{ index: "t", name: "T", desc: [], proficiencies: [ref("nope")] }],
    };
    expect(() => convertAll(bad)).toThrow(/Unknown proficiency: nope/);
  });

  it("turns a monster into structured data and strings", () => {
    const eagle = out.monster.entries.find((e) => e.id === "srd51:monster/giant-eagle");
    expect(eagle).toMatchObject({
      kind: "monster",
      data: {
        size: "large",
        type: "beast",
        armorClass: [{ type: "dex", value: 13 }],
        hitPoints: 26,
        speed: { walk: 10, fly: 80 },
        abilities: { str: 16, dex: 17, con: 13, int: 8, wis: 14, cha: 10 },
        skills: { perception: 4 },
        saves: { wis: 2 },
        senses: { blindsight: 30 },
        blindBeyond: ["blindsight"],
        passivePerception: 14,
        challenge: 1,
        actions: [
          { multiattack: [{ action: 2, count: 1 }] },
          { attackBonus: 5, damage: [{ type: "piercing", dice: "1d6+3" }] },
        ],
      },
    });
    expect(out.monster.strings["giant-eagle.name"]).toBe("Giant Eagle");
    expect(out.monster.strings["giant-eagle.resistances"]).toBe("fire");
    expect(out.monster.strings["giant-eagle.actions.2.name"]).toBe("Beak");
    expect(out.monster.strings["giant-eagle.special.1.desc"]).toBe("Advantage on sight checks.");
  });

  it("reads a swarm as a swarm of its creature type", () => {
    const swarm = out.monster.entries.find((e) => e.id === "srd51:monster/swarm-of-bats");
    expect(swarm?.data).toMatchObject({ type: "beast", swarm: "tiny", size: "medium" });
  });
});
