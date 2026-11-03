import { describe, expect, it } from "vitest";
import { srd51Index as index } from "../test/srd51";
import { createCharacter, createPlayState } from "./character";
import { deriveSheet } from "./derive";
import { canSpend, spendPool } from "./spends";

function hero(classes: { id: string; level: number; subclass?: string }[]) {
  const c = createCharacter("srd51");
  c.classes = classes.map((x) => ({
    classId: `srd51:class/${x.id}`,
    level: x.level,
    ...(x.subclass && { subclassId: `srd51:subclass/${x.subclass}` }),
  }));
  c.abilityBase = { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 16 };
  return deriveSheet(c, index);
}

describe("the features that spend a pool of the class", () => {
  it("takes one ki point for a Flurry of Blows, and four for Empty Body", () => {
    const sheet = hero([{ id: "monk", level: 18 }]);
    const flurry = sheet.spends["srd51:feature/flurry-of-blows"];
    expect(flurry).toMatchObject({ pool: "ki", cost: 1, resource: "ki:monk" });
    expect(sheet.spends["srd51:feature/empty-body"]?.cost).toBe(4);
  });

  it("spends from the pool and stops when it does not hold enough", () => {
    const sheet = hero([{ id: "monk", level: 2 }]);
    const flurry = sheet.spends["srd51:feature/flurry-of-blows"];
    expect(flurry).toBeDefined();
    if (!flurry) return;
    let play = createPlayState();
    expect(canSpend(play, flurry, sheet.resources)).toBe(true);
    play = spendPool(play, flurry, sheet.resources);
    play = spendPool(play, flurry, sheet.resources);
    expect(play.resourcesUsed?.["ki:monk"]).toBe(2);
    // A monk of level 2 has two points: the third use changes nothing.
    expect(canSpend(play, flurry, sheet.resources)).toBe(false);
    expect(spendPool(play, flurry, sheet.resources)).toEqual(play);
  });

  it("gives each class its own Channel Divinity", () => {
    const sheet = hero([
      { id: "cleric", level: 3 },
      { id: "paladin", level: 3, subclass: "devotion" },
    ]);
    expect(sheet.spends["srd51:feature/channel-divinity-turn-undead"]?.resource).toBe(
      "channelDivinity:cleric",
    );
    expect(sheet.spends["srd51:feature/channel-divinity-sacred-weapon"]?.resource).toBe(
      "channelDivinity:paladin",
    );
  });

  it("has nothing to spend for a pool the character does not have", () => {
    // A rogue has no ki: the monk's features are not hers anyway, and nothing is made up.
    expect(hero([{ id: "rogue", level: 5 }]).spends).toEqual({});
  });

  it("writes the action a feature takes in the data", () => {
    const entry = (id: string) => index.get(id)?.data.activation;
    expect(entry("srd51:feature/flurry-of-blows")).toBe("bonus");
    expect(entry("srd51:feature/cunning-action")).toBe("bonus");
    expect(entry("srd51:feature/uncanny-dodge")).toBe("reaction");
    expect(entry("srd51:feature/empty-body")).toBe("action");
    expect(entry("srd51:trait/breath-weapon")).toBe("action");
    // Action Surge is taken on the turn, with no action of its own.
    expect(entry("srd51:feature/action-surge-1-use")).toBeUndefined();
  });
});
