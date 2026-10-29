import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { createCharacter } from "./character";
import { entryRelinker, relinkCharacter } from "./relink";

const entry = (id: string, kind: Entry["kind"]): [string, Entry] => [
  id,
  { id, kind, effects: [], data: {} } as Entry,
];

describe("finding again what a character used from a pack that changed its id", () => {
  const index = new Map<string, Entry>([
    entry("srd51:species/dwarf", "species"),
    entry("impnew:species/custom-lineage", "species"),
    entry("impnew:background/entertainer", "background"),
    entry("impnew:spell/glimmer", "spell"),
    entry("impother:spell/glimmer", "spell"),
  ]);

  it("replaces ids that the content does not know with the one entry of the same name", () => {
    const c = createCharacter("srd51");
    c.choices.species = "impold:species/custom-lineage";
    c.choices.background = "impold:background/entertainer";
    c.selections["impold:species/custom-lineage/species-1"] = ["con"];
    const fixed = relinkCharacter(c, index);
    expect(fixed?.choices.species).toBe("impnew:species/custom-lineage");
    expect(fixed?.choices.background).toBe("impnew:background/entertainer");
    expect(fixed?.selections["impnew:species/custom-lineage/species-1"]).toEqual(["con"]);
  });

  it("takes the entry of the same pack that differs only by its number", () => {
    const c = createCharacter("srd51");
    c.choices.background = "impnew:background/entertainer-2";
    expect(relinkCharacter(c, index)?.choices.background).toBe("impnew:background/entertainer");
    // Two candidates with that name: nothing is guessed.
    const two = new Map(index).set(...entry("impnew:background/entertainer-3", "background"));
    expect(relinkCharacter(c, two)).toBeUndefined();
  });

  it("leaves alone what is known, what is of the SRD, and what is ambiguous or missing", () => {
    const c = createCharacter("srd51");
    c.choices.species = "srd51:species/dwarf";
    c.choices.background = "impnew:background/entertainer";
    c.spells["srd51:class/wizard"] = {
      cantrips: ["impold:spell/glimmer", "impold:spell/gone"],
      known: [],
      prepared: [],
    };
    expect(relinkCharacter(c, index)).toBeUndefined();
  });
});

describe("finding again one entry", () => {
  const index = new Map<string, Entry>([
    entry("srd51:species/dwarf", "species"),
    entry("impnew:species/custom-lineage", "species"),
  ]);
  const relink = entryRelinker(index);

  it("gives the entry of the same kind and name in another pack", () => {
    expect(relink("impold:species/custom-lineage")).toBe("impnew:species/custom-lineage");
  });

  it("gives nothing for a known id, an SRD id, or one that matches nothing", () => {
    expect(relink("impnew:species/custom-lineage")).toBeUndefined();
    expect(relink("srd51:species/elf")).toBeUndefined();
    expect(relink("impold:species/unknown")).toBeUndefined();
  });
});
