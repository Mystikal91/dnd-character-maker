import { describe, expect, it } from "vitest";
import { type Searchable, browse, fold, kindsOf, search } from "./search";

const entries = [
  ["srd51:spell/fireball", "spell", "Palla di fuoco", "Una sfera esplode in un fragore di fiamme."],
  ["srd51:spell/fire-bolt", "spell", "Dardo di fuoco", "Scagli un getto di fuoco."],
  ["srd51:skill/stealth", "skill", "Furtività", "Muoversi senza farsi sentire."],
  ["srd51:condition/grappled", "condition", "Afferrato", "La velocità diventa 0."],
  ["srd51:option/hidden", "option", "Nascosto", "Non si cerca."],
] as const;

const content: Searchable = {
  index: new Map(
    entries.map(([id, kind]) => [id, { id, kind, effects: [], data: {} }] as const),
  ) as Searchable["index"],
  name: (id) => entries.find((e) => e[0] === id)?.[2] ?? id,
  text: (id, field) => (field === "desc" ? entries.find((e) => e[0] === id)?.[3] : undefined),
};

describe("searching the rules", () => {
  it("folds accents and case", () => {
    expect(fold("Furtività")).toBe("furtivita");
  });

  it("finds a name without accents, and puts the name that starts with it first", () => {
    expect(search(content, "furtivita").map((h) => h.id)).toEqual(["srd51:skill/stealth"]);
    expect(search(content, "fuoco").map((h) => h.id)).toEqual([
      "srd51:spell/fire-bolt",
      "srd51:spell/fireball",
    ]);
    expect(search(content, "dardo")[0]?.name).toBe("Dardo di fuoco");
  });

  it("finds a word in the text when the name does not have it", () => {
    expect(search(content, "velocita").map((h) => h.id)).toEqual(["srd51:condition/grappled"]);
  });

  it("limits a search to one kind, and reads through a kind by name", () => {
    expect(search(content, "fuoco", "condition")).toEqual([]);
    expect(search(content, "fuoco", "spell")).toHaveLength(2);
    expect(browse(content, "spell").map((h) => h.name)).toEqual([
      "Dardo di fuoco",
      "Palla di fuoco",
    ]);
    expect(kindsOf(content)).toEqual(["spell", "condition", "skill"]);
  });

  it("needs every word, and ignores what is not worth looking up", () => {
    expect(search(content, "fuoco sfera").map((h) => h.id)).toEqual(["srd51:spell/fireball"]);
    expect(search(content, "nascosto")).toEqual([]);
    expect(search(content, "f")).toEqual([]);
  });
});
