import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { createCharacter } from "./character";
import { relinkCharacter } from "./relink";

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
