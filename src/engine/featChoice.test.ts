import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

const feat = (slug: string, effects: Entry["effects"] = []): Entry => ({
  id: `test:feat/${slug}`,
  kind: "feat",
  effects,
  data: {},
});

const custom: Entry = {
  id: "test:species/custom",
  kind: "species",
  effects: [{ type: "choice", id: "feat", choose: 1, grants: "feat", from: [] }],
  data: { speed: 30, size: "medium" },
};

const index = new Map([
  ...srd51Index,
  [custom.id, custom],
  ["test:feat/tough", feat("tough")],
  ["test:feat/sharp", feat("sharp", [{ type: "abilityBonus", ability: "int", value: 1 }])],
  [
    "test:species/gifted",
    {
      id: "test:species/gifted",
      kind: "species",
      effects: [{ type: "trait", id: "test:feat/tough" }],
      data: { speed: 30, size: "medium" },
    } satisfies Entry,
  ],
]);

function make(species: string) {
  const c = createCharacter("srd51");
  c.choices.species = species;
  c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
  return c;
}

describe("feats given by a species", () => {
  it("offers every feat when the choice lists none, and applies the one picked", () => {
    const c = make("test:species/custom");
    const before = deriveSheet(c, index);
    expect(before.choices[0]?.options.sort()).toEqual(["test:feat/sharp", "test:feat/tough"]);
    expect(before.choices[0]?.remaining).toBe(1);
    expect(before.feats).toEqual([]);

    c.selections["test:species/custom/feat"] = ["test:feat/sharp"];
    const sheet = deriveSheet(c, index);
    expect(sheet.feats).toEqual(["test:feat/sharp"]);
    expect(sheet.traits).not.toContain("test:feat/sharp");
    expect(sheet.abilities.int.bonus).toBe(1);
    expect(sheet.warnings).toEqual([]);
  });

  it("rejects something that is not a feat", () => {
    const c = make("test:species/custom");
    c.selections["test:species/custom/feat"] = ["srd51:class/fighter"];
    expect(deriveSheet(c, index).warnings.map((w) => w.code)).toContain("invalidChoice");
  });

  it("lists a feat that is simply granted with the feats, not with the traits", () => {
    const sheet = deriveSheet(make("test:species/gifted"), index);
    expect(sheet.feats).toEqual(["test:feat/tough"]);
    expect(sheet.traits).not.toContain("test:feat/tough");
  });
});
