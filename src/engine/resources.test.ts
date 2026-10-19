import { describe, expect, it } from "vitest";
import { srd51Index as index } from "../test/srd51";
import { createCharacter, createPlayState } from "./character";
import { deriveSheet } from "./derive";
import { doubleDice } from "./dice";
import {
  concentrationDc,
  endConcentration,
  resourceLeft,
  setResourceUsed,
  shortRest,
  startConcentration,
} from "./play";

function hero(classes: { id: string; level: number }[], scores = {}) {
  const c = createCharacter("srd51");
  c.classes = classes.map((x) => ({ classId: `srd51:class/${x.id}`, level: x.level }));
  c.abilityBase = { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 16, ...scores };
  return deriveSheet(c, index);
}

const kinds = (sheet: ReturnType<typeof hero>) =>
  Object.fromEntries(sheet.resources.map((r) => [r.kind, r.max]));

describe("class resources", () => {
  it("gives a fighter Second Wind and Action Surge, and Indomitable later", () => {
    expect(kinds(hero([{ id: "fighter", level: 1 }]))).toEqual({ secondWind: 1 });
    expect(kinds(hero([{ id: "fighter", level: 2 }]))).toEqual({ secondWind: 1, actionSurge: 1 });
    expect(kinds(hero([{ id: "fighter", level: 9 }]))).toEqual({
      secondWind: 1,
      actionSurge: 1,
      indomitable: 1,
    });
    expect(kinds(hero([{ id: "fighter", level: 17 }]))).toMatchObject({
      actionSurge: 2,
      indomitable: 3,
    });
  });

  it("counts a barbarian's rages and shows the rage damage", () => {
    const sheet = hero([{ id: "barbarian", level: 3 }]);
    expect(sheet.resources).toEqual([
      expect.objectContaining({ kind: "rage", max: 3, recovery: "long" }),
    ]);
    expect(sheet.facts).toContainEqual({ kind: "rageDamage", params: { n: 2 } });
    expect(hero([{ id: "barbarian", level: 20 }]).resources[0]?.unlimited).toBe(true);
  });

  it("makes ki a pool that comes back on a short rest", () => {
    const sheet = hero([{ id: "monk", level: 5 }]);
    expect(sheet.resources).toEqual([
      expect.objectContaining({ kind: "ki", max: 5, recovery: "short", pool: true }),
    ]);
    expect(sheet.facts).toContainEqual({ kind: "martialArts", params: { dice: "1d6" } });
  });

  it("ties Bardic Inspiration and Divine Sense to Charisma", () => {
    // Charisma 16 is +3.
    expect(kinds(hero([{ id: "bard", level: 4 }]))).toEqual({ bardicInspiration: 3 });
    expect(hero([{ id: "bard", level: 4 }]).resources[0]?.recovery).toBe("long");
    expect(hero([{ id: "bard", level: 5 }]).resources[0]?.recovery).toBe("short");
    expect(kinds(hero([{ id: "paladin", level: 3 }]))).toEqual({
      layOnHands: 15,
      divineSense: 4,
      channelDivinity: 1,
    });
  });

  it("lists sneak attack dice, Wild Shape and Arcane Recovery", () => {
    expect(hero([{ id: "rogue", level: 5 }]).facts).toContainEqual({
      kind: "sneakAttack",
      params: { dice: "3d6" },
    });
    expect(kinds(hero([{ id: "druid", level: 2 }]))).toEqual({ wildShape: 2 });
    expect(kinds(hero([{ id: "wizard", level: 1 }]))).toEqual({ arcaneRecovery: 1 });
    expect(kinds(hero([{ id: "sorcerer", level: 3 }]))).toEqual({ sorceryPoints: 3 });
  });

  it("tracks each Mystic Arcanum of a warlock", () => {
    const sheet = hero([{ id: "warlock", level: 13 }]);
    expect(sheet.resources.filter((r) => r.kind === "mysticArcanum").map((r) => r.level)).toEqual([
      6, 7,
    ]);
  });

  it("keeps the resources of every class of a multiclass character", () => {
    const sheet = hero([
      { id: "fighter", level: 2 },
      { id: "barbarian", level: 1 },
    ]);
    expect(sheet.resources.map((r) => r.id).sort()).toEqual([
      "actionSurge:fighter",
      "rage:barbarian",
      "secondWind:fighter",
    ]);
  });
});

describe("spending resources", () => {
  it("counts uses left and never goes out of range", () => {
    let play = createPlayState();
    expect(resourceLeft(play, "rage:barbarian", 3)).toBe(3);
    play = setResourceUsed(play, "rage:barbarian", 2, 3);
    expect(resourceLeft(play, "rage:barbarian", 3)).toBe(1);
    expect(resourceLeft(setResourceUsed(play, "rage:barbarian", 9, 3), "rage:barbarian", 3)).toBe(
      0,
    );
    expect(resourceLeft(setResourceUsed(play, "rage:barbarian", -4, 3), "rage:barbarian", 3)).toBe(
      3,
    );
  });

  it("gives back only what a short rest recovers", () => {
    let play = setResourceUsed(createPlayState(), "ki:monk", 3, 5);
    play = setResourceUsed(play, "rage:barbarian", 1, 3);
    const rested = shortRest(play, "none", ["ki:monk"]);
    expect(resourceLeft(rested, "ki:monk", 5)).toBe(5);
    expect(resourceLeft(rested, "rage:barbarian", 3)).toBe(2);
  });
});

describe("concentration", () => {
  it("starts on a spell, replaces it and ends", () => {
    let play = startConcentration(createPlayState(), "srd51:spell/bless");
    expect(play.concentration).toBe("srd51:spell/bless");
    play = startConcentration(play, "srd51:spell/haste");
    expect(play.concentration).toBe("srd51:spell/haste");
    expect(endConcentration(play).concentration).toBeUndefined();
  });

  it("asks for a save of 10 or half the damage, whichever is higher", () => {
    expect(concentrationDc(4)).toBe(10);
    expect(concentrationDc(22)).toBe(11);
    expect(concentrationDc(31)).toBe(15);
  });
});

describe("critical hits", () => {
  it("doubles the dice and keeps the bonus", () => {
    expect(doubleDice("1d8+3")).toBe("2d8+3");
    expect(doubleDice("2d6")).toBe("4d6");
    expect(doubleDice("1d6+1d4-1")).toBe("2d6+2d4-1");
    expect(doubleDice("sword")).toBeUndefined();
  });
});
