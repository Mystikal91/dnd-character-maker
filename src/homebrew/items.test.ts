import { describe, expect, it } from "vitest";
import { itemData } from "../data/items";
import { parsePack } from "../data/schema";
import type { Entry } from "../data/schema";
import { createCharacter } from "../engine/character";
import { deriveSheet } from "../engine/derive";
import { srd51Index } from "../test/srd51";
import { type Draft, blankDraft, draftFromEntry, newHomebrewPack, saveDraft } from "./model";

const context = { languages: ["common"] };
const draft = (kind: Draft["kind"], values: Record<string, string>): Draft => ({
  ...blankDraft(kind),
  values,
});

describe("homebrew properties", () => {
  it("makes a property with a title and a text, and reads it back", () => {
    const record = newHomebrewPack("Mine", 1000);
    const { record: saved, id } = saveDraft(
      record,
      draft("property", { name: "Singing", desc: "It hums when drawn." }),
      context,
    );
    expect(id).toBe(`${record.id}:property/singing`);
    const entry = saved.pack.entries.find((e) => e.id === id);
    expect(entry?.kind).toBe("property");
    expect(saved.strings[`${id}.name`]).toBe("Singing");
    expect(saved.strings[`${id}.desc`]).toBe("It hums when drawn.");
    expect(() => parsePack(saved.pack)).not.toThrow();
    const back = entry && draftFromEntry(entry, saved.strings, saved.pack.entries);
    expect(back?.kind).toBe("property");
    expect(back?.values.desc).toBe("It hums when drawn.");
  });
});

describe("homebrew weapons and armor", () => {
  it("keeps a bonus, the magic and the properties of a weapon, and gives them back", () => {
    const record = newHomebrewPack("Mine", 1000);
    const { record: withProperty, id: property } = saveDraft(
      record,
      draft("property", { name: "Singing" }),
      context,
    );
    const { record: saved, id } = saveDraft(
      withProperty,
      draft("weapon", {
        name: "Humming Blade",
        damage: "1d8",
        damageType: "slashing",
        enhancement: "2",
        magical: "true",
        properties: `srd51:property/finesse,${property}`,
      }),
      context,
    );
    const entry = saved.pack.entries.find((e) => e.id === id) as Entry;
    const data = itemData(entry);
    expect(data.enhancement).toBe(2);
    expect(data.magical).toBe(true);
    expect(data.weapon?.properties).toEqual(["srd51:property/finesse", property]);
    expect(() => parsePack(saved.pack)).not.toThrow();
    const back = draftFromEntry(entry, saved.strings, saved.pack.entries);
    expect(back?.values.enhancement).toBe("2");
    expect(back?.values.magical).toBe("true");
    expect(back?.values.properties).toBe(`srd51:property/finesse,${property}`);
  });

  it("leaves out a bonus of nothing and caps one that is too big", () => {
    const record = newHomebrewPack("Mine", 1000);
    const plain = saveDraft(record, draft("weapon", { name: "Stick", enhancement: "0" }), context);
    expect(itemData(plain.record.pack.entries[0] as Entry).enhancement).toBeUndefined();
    const big = saveDraft(record, draft("weapon", { name: "Big", enhancement: "9" }), context);
    expect(itemData(big.record.pack.entries[0] as Entry).enhancement).toBe(3);
  });

  it("gives an armor properties and keeps them", () => {
    const record = newHomebrewPack("Mine", 1000);
    const { record: saved, id } = saveDraft(
      record,
      draft("armor", {
        name: "Mirror Plate",
        acategory: "heavy",
        base: "18",
        properties: "srd51:property/heavy",
      }),
      context,
    );
    const entry = saved.pack.entries.find((e) => e.id === id) as Entry;
    expect(itemData(entry).armor?.properties).toEqual(["srd51:property/heavy"]);
    const back = draftFromEntry(entry, saved.strings, saved.pack.entries);
    expect(back?.kind).toBe("armor");
    expect(back?.values.properties).toBe("srd51:property/heavy");
  });
});

describe("a homebrew weapon on the sheet", () => {
  it("adds its own bonus to attack and damage and counts as magic", () => {
    const record = newHomebrewPack("Mine", 1000);
    const { record: saved, id } = saveDraft(
      record,
      draft("weapon", {
        name: "Plus One",
        damage: "1d8",
        damageType: "slashing",
        wcategory: "martial",
        enhancement: "1",
      }),
      context,
    );
    const index = new Map<string, Entry>([
      ...srd51Index,
      ...saved.pack.entries.map((e) => [e.id, e] as const),
    ]);
    const attackOf = (itemId: string) => {
      const c = createCharacter("srd51");
      c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
      c.abilityBase = { str: 14, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
      c.inventory = [{ itemId, quantity: 1, equipped: true }];
      return deriveSheet(c, index).attacks.find((a) => a.itemId === itemId);
    };
    const mine = attackOf(id);
    const plain = attackOf("srd51:item/longsword");
    expect(mine?.enhancement).toBe(1);
    expect(mine?.magical).toBe(true);
    expect(mine?.attackBonus).toBe((plain?.attackBonus ?? 0) + 1);
    expect(mine?.damage?.bonus).toBe((plain?.damage?.bonus ?? 0) + 1);
    expect(plain?.magical).toBe(false);
  });
});
