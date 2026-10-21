import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

const species: Entry = {
  id: "test:species/dune",
  kind: "species",
  effects: [
    { type: "abilityBonus", ability: "str", value: 2 },
    { type: "trait", id: "test:trait/old" },
  ],
  data: { speed: 35, size: "medium" },
};
const variant: Entry = {
  id: "test:subspecies/wanderer",
  kind: "subspecies",
  parent: "test:species/dune",
  effects: [
    { type: "abilityBonus", ability: "dex", value: 2 },
    { type: "trait", id: "test:trait/new" },
  ],
  data: { replacesSpecies: true },
};
const plain: Entry = { ...variant, id: "test:subspecies/plain", data: {} };
const trait = (slug: string): Entry => ({
  id: `test:trait/${slug}`,
  kind: "trait",
  effects: [],
  data: {},
});
const index = new Map<string, Entry>([
  ...srd51Index,
  [species.id, species],
  [variant.id, variant],
  [plain.id, plain],
  ["test:trait/old", trait("old")],
  ["test:trait/new", trait("new")],
]);

function make(subspecies: string) {
  const c = createCharacter("srd51");
  c.choices.species = species.id;
  c.choices.subspecies = subspecies;
  c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
  return c;
}

describe("a variant that stands in for its species", () => {
  it("replaces the species' own effects with its own", () => {
    const sheet = deriveSheet(make(variant.id), index);
    expect(sheet.abilities.str.bonus).toBe(0);
    expect(sheet.abilities.dex.bonus).toBe(2);
    expect(sheet.traits).toEqual(["test:trait/new"]);
    // What the species says about speed still holds.
    expect(sheet.speed).toBe(35);
  });

  it("leaves an ordinary subspecies adding to its species", () => {
    const sheet = deriveSheet(make(plain.id), index);
    expect(sheet.abilities.str.bonus).toBe(2);
    expect(sheet.abilities.dex.bonus).toBe(2);
    expect(sheet.traits).toEqual(["test:trait/old", "test:trait/new"]);
  });
});
