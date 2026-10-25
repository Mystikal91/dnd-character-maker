import { describe, expect, it } from "vitest";
import { type Pack, brokenReferences, findBrokenReferences } from "./schema";

const pack = (id: string, entries: Pack["entries"]): Pack => ({
  manifest: { id, ruleset: "custom", version: "1", license: "x", attribution: "x" },
  entries,
});

describe("references to content that is missing", () => {
  const a = pack("a", [
    { id: "a:species/one", kind: "species", effects: [{ type: "trait", id: "b:trait/gone" }], data: {} },
    {
      id: "a:species/two",
      kind: "species",
      // Behind a requirement, a reference is still a reference.
      effects: [
        {
          type: "when",
          requires: "x",
          effects: [{ type: "grantSpell", spell: "b:spell/gone" }],
        },
      ],
      data: {},
    },
  ]);
  const b = pack("b", [{ id: "b:trait/here", kind: "trait", effects: [], data: {} }]);

  it("names the entry that refers and what it cannot find, also inside a requirement", () => {
    expect(brokenReferences([a, b])).toEqual([
      { from: "a:species/one", ref: "b:trait/gone" },
      { from: "a:species/two", ref: "b:spell/gone" },
    ]);
  });

  it("says it in words too, and is empty when everything resolves", () => {
    expect(findBrokenReferences([a, b])[0]).toBe("a:species/one references missing b:trait/gone");
    expect(brokenReferences([b])).toEqual([]);
  });
});
