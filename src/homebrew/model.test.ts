import { describe, expect, it } from "vitest";
import { classData } from "../data/progression";
import { parsePack } from "../data/schema";
import type { Entry } from "../data/schema";
import { createCharacter } from "../engine/character";
import { deriveSheet } from "../engine/derive";
import { srd51Index } from "../test/srd51";
import {
  type Draft,
  blankDraft,
  draftFromEntry,
  editableEntries,
  newHomebrewPack,
  removeEntry,
  saveDraft,
} from "./model";

const context = { languages: ["common", "elvish"] };
const draft = (
  kind: Draft["kind"],
  values: Record<string, string>,
  traits: Draft["traits"] = [],
) => ({
  ...blankDraft(kind),
  values,
  traits,
});

describe("homebrew entries", () => {
  it("makes entries of every kind that the pack schema accepts", () => {
    let record = newHomebrewPack("Mine", 1000);
    const drafts = [
      draft("spell", {
        name: "Glow",
        level: "1",
        school: "evocation",
        compV: "true",
        classes: "srd51:class/wizard",
        desc: "Shines.",
      }),
      draft("weapon", {
        name: "Sun Blade",
        wcategory: "martial",
        wkind: "melee",
        damage: "1d8",
        damageType: "radiant",
        properties: "srd51:property/finesse",
        costAmount: "50",
        costUnit: "gp",
        weight: "3",
      }),
      draft("weapon", {
        name: "Sling Shot",
        wkind: "ranged",
        damage: "1d4",
        damageType: "bludgeoning",
        rangeNormal: "30",
        rangeLong: "120",
      }),
      draft("armor", {
        name: "Moss Mail",
        acategory: "medium",
        base: "13",
        dexBonus: "true",
        maxDex: "2",
        strMin: "13",
      }),
      draft("gear", { name: "Fancy Rope", costAmount: "3", costUnit: "sp" }),
      draft("language", { name: "Gnarl", speakers: "Trees", script: "Runes" }),
      draft("feat", {
        name: "Tough Skin",
        bonusAbility: "con",
        bonusValue: "1",
        prereqAbility: "str",
        prereqMin: "13",
      }),
      draft(
        "species",
        {
          name: "Moss Folk",
          speed: "25",
          size: "small",
          "bonus-con": "2",
          languages: "common,elvish",
        },
        [{ name: "Photosynthesis", text: "You rest in light." }],
      ),
      draft("background", {
        name: "Hermit Scholar",
        skills: "srd51:skill/arcana".replace("srd51:skill/", ""),
        languageChoices: "1",
        featureName: "Quiet",
        featureDesc: "Peace.",
        ideals: "Calm\nSilence",
      }),
    ];
    for (const d of drafts) record = saveDraft(record, d, context).record;
    expect(() => parsePack(record.pack)).not.toThrow();
    expect(record.pack.entries.map((e) => e.kind)).toEqual(
      expect.arrayContaining([
        "spell",
        "item",
        "language",
        "feat",
        "species",
        "trait",
        "background",
      ]),
    );
    expect(
      record.strings[
        `${record.id}:species/moss-folk.name`.replace(`${record.id}:`, `${record.id}:`)
      ],
    ).toBe("Moss Folk");
  });

  it("opens an entry again as the form it came from", () => {
    const record = saveDraft(
      newHomebrewPack("Mine", 1000),
      draft(
        "species",
        { name: "Moss Folk", speed: "25", size: "small", "bonus-con": "2", languages: "common" },
        [{ name: "Photosynthesis", text: "You rest in light." }],
      ),
      context,
    ).record;
    const entry = record.pack.entries.find((e) => e.kind === "species");
    const back = entry && draftFromEntry(entry, record.strings, record.pack.entries);
    expect(back?.values).toMatchObject({
      name: "Moss Folk",
      speed: "25",
      size: "small",
      "bonus-con": "2",
      languages: "common",
    });
    expect(back?.traits).toEqual([{ name: "Photosynthesis", text: "You rest in light." }]);
  });

  it("replaces an edited entry and removes the traits and texts it owned", () => {
    const first = saveDraft(
      newHomebrewPack("Mine", 1000),
      draft("species", { name: "Moss Folk" }, [{ name: "Photosynthesis", text: "x" }]),
      context,
    );
    const edited = saveDraft(
      first.record,
      draft("species", { name: "Moss Folk" }, [{ name: "Sap", text: "y" }]),
      context,
      first.id,
    ).record;
    expect(edited.pack.entries.filter((e) => e.kind === "trait")).toHaveLength(1);
    expect(Object.values(edited.strings)).toContain("Sap");
    expect(Object.values(edited.strings)).not.toContain("Photosynthesis");
    const emptied = removeEntry(edited, first.id);
    expect(emptied.pack.entries).toEqual([]);
    expect(emptied.strings).toEqual({});
  });

  it("gives equal names their own ids", () => {
    let record = newHomebrewPack("Mine", 1000);
    record = saveDraft(record, draft("gear", { name: "Rope" }), context).record;
    record = saveDraft(record, draft("gear", { name: "Rope" }), context).record;
    expect(record.pack.entries.map((e) => e.id)).toEqual([
      `${record.id}:item/rope`,
      `${record.id}:item/rope-2`,
    ]);
    expect(editableEntries(record)).toHaveLength(2);
  });

  it("works in a character: a homebrew species and feat change the sheet", () => {
    let record = newHomebrewPack("Mine", 1000);
    const species = saveDraft(
      record,
      draft("species", { name: "Moss Folk", speed: "25", "bonus-con": "2" }),
      context,
    );
    record = species.record;
    const feat = saveDraft(
      record,
      draft("feat", { name: "Tough Skin", bonusAbility: "str", bonusValue: "1" }),
      context,
    );
    const index = new Map([
      ...srd51Index,
      ...feat.record.pack.entries.map((e) => [e.id, e] as const),
    ]);
    const c = createCharacter("srd51");
    c.choices.species = species.id;
    c.classes = [{ classId: "srd51:class/fighter", level: 4 }];
    c.abilityBase = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    c.feats = [feat.id];
    const sheet = deriveSheet(c, index);
    expect(sheet.abilities.con.score).toBe(12);
    expect(sheet.abilities.str.score).toBe(11);
    expect(sheet.speed).toBe(25);
  });
});

describe("homebrew classes", () => {
  const classDraft = draft(
    "class",
    {
      name: "Tinker Mage",
      hitDie: "8",
      saves: "int,wis",
      armor: "light-armor",
      weapons: "simple-weapons",
      skillCount: "2",
      skills: "arcana,history,investigation",
      casting: "half",
      castAbility: "int",
      preparation: "prepared",
      cantrips: "2",
      multiAbility: "int",
      multiMin: "13",
      desc: "A maker of clever things.",
    },
    [
      { name: "Gadgets", text: "You build gadgets.", level: "1" },
      { name: "Tinker Path", text: "Choose a path.", level: "3" },
    ],
  );

  it("makes a class that passes the schema, with its features and tables", () => {
    const made = saveDraft(newHomebrewPack("Mine", 1000), classDraft, { ...context, skills: [] });
    expect(() => parsePack(made.record.pack)).not.toThrow();
    const entry = made.record.pack.entries.find((e) => e.kind === "class");
    const data = entry && classData(entry);
    expect(data?.hitDie).toBe(8);
    expect(data?.levels).toHaveLength(20);
    expect(data?.levels[0]?.features).toHaveLength(1);
    expect(data?.levels[1]?.spellSlots).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(data?.levels[4]?.spellSlots).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0]);
    expect(data?.levels[3]?.cantripsKnown).toBe(3);
    expect(data?.levels[3]?.abilityScoreImprovements).toBe(1);
    expect(data?.spellcasting).toMatchObject({
      startsAtLevel: 2,
      preparation: { levelDivisor: 2 },
    });
    expect(data?.multiclassing.prerequisites).toEqual([{ ability: "int", minimum: 13 }]);
  });

  it("makes Pact Magic slots of one growing level", () => {
    const made = saveDraft(
      newHomebrewPack("Mine", 1000),
      draft("class", {
        name: "Binder",
        casting: "pact",
        castAbility: "cha",
        preparation: "known",
        cantrips: "2",
      }),
      context,
    );
    const data = classData(made.record.pack.entries.find((e) => e.kind === "class") as Entry);
    expect(data.spellcasting?.pact).toBe(true);
    expect(data.levels[0]?.spellSlots).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(data.levels[2]?.spellSlots).toEqual([0, 2, 0, 0, 0, 0, 0, 0, 0]);
    expect(data.levels[10]?.spellSlots).toEqual([0, 0, 0, 0, 3, 0, 0, 0, 0]);
    expect(data.levels[0]?.spellsKnown).toBe(2);
  });

  it("works in a character, with a subclass, and opens again for editing", () => {
    const made = saveDraft(newHomebrewPack("Mine", 1000), classDraft, context);
    const sub = saveDraft(
      made.record,
      draft("subclass", { name: "Clockwork", parent: made.id, desc: "Gears." }, [
        { name: "Springs", text: "Boing.", level: "3" },
      ]),
      context,
    );
    expect(() => parsePack(sub.record.pack)).not.toThrow();
    const index = new Map([
      ...srd51Index,
      ...sub.record.pack.entries.map((e) => [e.id, e] as const),
    ]);
    const c = createCharacter("srd51");
    c.classes = [{ classId: made.id, level: 5, subclassId: sub.id }];
    c.abilityBase = { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 };
    const sheet = deriveSheet(c, index);
    expect(sheet.spellSlots).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0]);
    expect(sheet.spellcasters[0]?.cantripsKnown).toBe(3);

    const entry = sub.record.pack.entries.find((e) => e.id === sub.id) as Entry;
    const back = draftFromEntry(entry, sub.record.strings, sub.record.pack.entries);
    expect(back?.values.parent).toBe(made.id);
    expect(back?.traits).toEqual([{ name: "Springs", text: "Boing.", level: "3" }]);
    const classEntry = made.record.pack.entries.find((e) => e.id === made.id) as Entry;
    const classBack = draftFromEntry(classEntry, made.record.strings, made.record.pack.entries);
    expect(classBack?.values).toMatchObject({
      hitDie: "8",
      casting: "half",
      cantrips: "2",
      asiLevels: "4,8,12,16,19",
    });
    expect(classBack?.traits.map((t) => t.name)).toEqual(["Gadgets", "Tinker Path"]);

    const without = removeEntry(sub.record, made.id);
    expect(without.pack.entries.map((e) => e.kind)).toEqual(["subclass", "feature"]);
  });
});
