import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

const breath: Entry = {
  id: "test:trait/breath",
  kind: "trait",
  effects: [
    { type: "featureValue", name: "breath weapon:dc", term: 8 },
    { type: "featureValue", name: "breath weapon:dc", term: { mod: "con" } },
    { type: "featureValue", name: "breath weapon:dc", term: { of: "proficiency" } },
    { type: "featureValue", name: "breath weapon:dice count", term: 1, minLevel: 1 },
    { type: "featureValue", name: "breath weapon:dice count", term: 2, minLevel: 5 },
    { type: "featureValue", name: "breath weapon:dice count", term: 3, minLevel: 11 },
    { type: "featureValue", name: "ancestry:damage type", term: { text: "Acid" } },
    { type: "featureValue", name: "mind link:range", term: { classLevel: "fighter" } },
  ],
  data: {},
};
const species: Entry = {
  id: "test:species/drake",
  kind: "species",
  effects: [{ type: "trait", id: breath.id }],
  data: {},
};
const index = new Map<string, Entry>([...srd51Index, [breath.id, breath], [species.id, species]]);

function valuesAt(level: number) {
  const c = createCharacter("srd51");
  c.choices.species = species.id;
  c.classes = [{ classId: "srd51:class/fighter", level }];
  c.abilityBase = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 };
  return Object.fromEntries(
    (deriveSheet(c, index).featureValues[breath.id] ?? []).map((v) => [v.name, v.value]),
  );
}

describe("numbers a feature shows", () => {
  it("adds the terms of a number and takes the latest step the level has reached", () => {
    expect(valuesAt(1)).toMatchObject({
      "breath weapon:dc": "12",
      "breath weapon:dice count": "1",
    });
    expect(valuesAt(5)).toMatchObject({
      "breath weapon:dc": "13",
      "breath weapon:dice count": "2",
    });
    expect(valuesAt(12)["breath weapon:dice count"]).toBe("3");
  });

  it("shows a word as it is and reads the level in a class", () => {
    expect(valuesAt(7)).toMatchObject({ "ancestry:damage type": "Acid", "mind link:range": "7" });
  });
});
