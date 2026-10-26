import { describe, expect, it } from "vitest";
import type { Entry } from "../../data/schema";
import { createCharacter } from "../../engine/character";
import { migrateCharacter, migrationMap } from "./migrate";

const trait = (id: string): Entry => ({ id, kind: "trait", effects: [], data: {} }) as Entry;

const pack = (list: [string, string, string][], aids?: Record<string, string>) => ({
  entries: list.map(([id]) => trait(id)),
  strings: Object.fromEntries(
    list.flatMap(([id, name, desc]) => [
      [`${id}.name`, name],
      [`${id}.desc`, desc],
    ]),
  ),
  ...(aids && { aids }),
});

describe("moving what characters use when a pack is imported again", () => {
  it("follows the Aurora ids when both imports know them", () => {
    const old = pack(
      [
        ["p:trait/charisma", "Charisma", "Fey Touched."],
        ["p:trait/charisma-2", "Charisma", "Shadow Touched."],
      ],
      { ID_FEY_CHA: "p:trait/charisma", ID_SHADOW_CHA: "p:trait/charisma-2" },
    );
    // The numbers were handed out the other way round.
    const next = pack(
      [
        ["p:trait/charisma", "Charisma", "Shadow Touched."],
        ["p:trait/charisma-2", "Charisma", "Fey Touched."],
      ],
      { ID_FEY_CHA: "p:trait/charisma-2", ID_SHADOW_CHA: "p:trait/charisma" },
    );
    expect(Object.fromEntries(migrationMap(old, next))).toEqual({
      "p:trait/charisma": "p:trait/charisma-2",
      "p:trait/charisma-2": "p:trait/charisma",
    });
  });

  it("matches by name and text a pack imported before the Aurora ids were kept", () => {
    const old = pack([
      ["p:trait/charisma-2", "Charisma", "Fey Touched."],
      ["p:trait/charisma-6", "Charisma", "Shadow Touched."],
      ["p:trait/alert", "Alert", "You are alert."],
    ]);
    const next = pack([
      ["p:trait/charisma", "Charisma", "Shadow Touched."],
      ["p:trait/charisma-11", "Charisma", "Fey Touched."],
      ["p:trait/alert", "Alert", "You are alert."],
    ]);
    expect(Object.fromEntries(migrationMap(old, next))).toEqual({
      "p:trait/charisma-2": "p:trait/charisma-11",
      "p:trait/charisma-6": "p:trait/charisma",
    });
  });

  it("guesses nothing when entries say the same, and leaves what did not change", () => {
    const old = pack([["p:trait/charisma-2", "Charisma", "Same."]]);
    const next = pack([
      ["p:trait/charisma", "Charisma", "Same."],
      ["p:trait/charisma-3", "Charisma", "Same."],
    ]);
    expect(migrationMap(old, next).size).toBe(0);
    expect(
      migrationMap(pack([["p:trait/a", "A", "x"]]), pack([["p:trait/a", "A", "x"]])).size,
    ).toBe(0);
  });

  it("rewrites the ids of a character, its picks and the keys of its picks", () => {
    const c = createCharacter("srd51");
    c.choices.background = "p:background/entertainer-2";
    c.selections["p:feat/fey-touched/offer"] = ["p:trait/charisma-2"];
    c.selections["p:background/entertainer-2/background-1"] = ["tool:bagpipes"];
    const map = new Map([
      ["p:trait/charisma-2", "p:trait/charisma-11"],
      ["p:background/entertainer-2", "p:background/entertainer"],
    ]);
    const moved = migrateCharacter(c, map);
    expect(moved?.choices.background).toBe("p:background/entertainer");
    expect(moved?.selections["p:feat/fey-touched/offer"]).toEqual(["p:trait/charisma-11"]);
    expect(moved?.selections["p:background/entertainer/background-1"]).toEqual(["tool:bagpipes"]);
    expect(migrateCharacter(createCharacter("srd51"), map)).toBeUndefined();
  });
});
