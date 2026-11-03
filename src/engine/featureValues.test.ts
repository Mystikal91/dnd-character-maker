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
    // Totals: of a kind of bonus that does not stack, the highest counts.
    { type: "featureValue", name: "breath weapon:dice count", term: 1, minLevel: 1, bonus: "base" },
    { type: "featureValue", name: "breath weapon:dice count", term: 2, minLevel: 5, bonus: "base" },
    {
      type: "featureValue",
      name: "breath weapon:dice count",
      term: 3,
      minLevel: 11,
      bonus: "base",
    },
    // Steps: with no kind of bonus they add up, as a rage count does (2, then 1 more at the 3rd).
    { type: "featureValue", name: "rage:count", term: 2, minLevel: 1 },
    { type: "featureValue", name: "rage:count", term: 1, minLevel: 3 },
    { type: "featureValue", name: "rage:count", term: 1, minLevel: 6 },
    // A total over a base: the base and the step are of the same kind, so the step takes its place.
    { type: "featureValue", name: "aura:range", term: 10, bonus: "base" },
    { type: "featureValue", name: "aura:range", term: 30, minLevel: 18, bonus: "base" },
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
  it("adds the terms of a number", () => {
    expect(valuesAt(1)["breath weapon:dc"]).toBe("12");
    expect(valuesAt(5)["breath weapon:dc"]).toBe("13");
  });

  it("takes the highest of a kind of bonus that does not stack", () => {
    expect(valuesAt(1)["breath weapon:dice count"]).toBe("1");
    expect(valuesAt(5)["breath weapon:dice count"]).toBe("2");
    expect(valuesAt(12)["breath weapon:dice count"]).toBe("3");
    // The base of 10 and the 30 of the 18th level are of one kind: 30, not 40.
    expect(valuesAt(17)["aura:range"]).toBe("10");
    expect(valuesAt(18)["aura:range"]).toBe("30");
  });

  it("adds the steps that have no kind of bonus", () => {
    expect(valuesAt(1)["rage:count"]).toBe("2");
    expect(valuesAt(3)["rage:count"]).toBe("3");
    expect(valuesAt(6)["rage:count"]).toBe("4");
    expect(valuesAt(12)["rage:count"]).toBe("4");
  });

  it("shows a word as it is and reads the level in a class", () => {
    expect(valuesAt(7)).toMatchObject({ "ancestry:damage type": "Acid", "mind link:range": "7" });
  });
});
