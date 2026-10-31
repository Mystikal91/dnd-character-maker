import { describe, expect, it } from "vitest";
import { classData } from "../data/progression";
import { srd51Index } from "../test/srd51";
import { createCharacter, createPlayState } from "./character";
import { parseCharacter } from "./characterSchema";
import { longRest, shortRest } from "./play";
import {
  assumeBeast,
  canAssume,
  damageBeast,
  healBeast,
  healWithSlot,
  leaveBeast,
  wildShapeLimits,
} from "./wildShape";

const druid = classData(srd51Index.get("srd51:class/druid") as never);
const beast = (slug: string) => {
  const entry = srd51Index.get(`srd51:monster/${slug}`);
  if (!entry) throw new Error(`missing ${slug}`);
  return entry;
};

describe("the limits of Wild Shape", () => {
  it("come from the table of the class", () => {
    expect(wildShapeLimits(druid, 1)).toBeUndefined();
    expect(wildShapeLimits(druid, 2)).toEqual({ maxCr: 0.25, swim: false, fly: false, hours: 1 });
    expect(wildShapeLimits(druid, 4)).toEqual({ maxCr: 0.5, swim: true, fly: false, hours: 2 });
    expect(wildShapeLimits(druid, 8)).toEqual({ maxCr: 1, swim: true, fly: true, hours: 4 });
  });

  it("let a druid of the Moon ignore the challenge rating of the table, and no other limit", () => {
    expect(wildShapeLimits(druid, 2, true)).toMatchObject({ maxCr: 1, swim: false, fly: false });
    expect(wildShapeLimits(druid, 6, true)?.maxCr).toBe(2);
    expect(wildShapeLimits(druid, 9, true)).toMatchObject({ maxCr: 3, fly: true });
  });
});

describe("which beasts a druid can become", () => {
  const level = (n: number) => {
    const limits = wildShapeLimits(druid, n);
    if (!limits) throw new Error("no limits");
    return limits;
  };

  it("keeps to the challenge rating", () => {
    expect(canAssume(beast("wolf"), level(2))).toBe(true); // 1/4
    expect(canAssume(beast("brown-bear"), level(2))).toBe(false); // 1
    expect(canAssume(beast("brown-bear"), level(8))).toBe(true);
  });

  it("keeps to the movement the level allows", () => {
    expect(canAssume(beast("crocodile"), level(2))).toBe(false); // swims
    expect(canAssume(beast("crocodile"), level(4))).toBe(true);
    expect(canAssume(beast("giant-eagle"), level(4))).toBe(false); // flies
    expect(canAssume(beast("giant-eagle"), level(8))).toBe(true);
  });

  it("allows animals only", () => {
    expect(canAssume(beast("imp"), level(20))).toBe(false); // a fiend
    expect(canAssume(beast("swarm-of-bats"), level(20))).toBe(false);
    expect(canAssume(beast("adult-red-dragon"), level(20))).toBe(false);
    // A creature that depends on the level has no hit points to take.
    const scaling = { ...beast("wolf"), data: { ...beast("wolf").data, hitPoints: undefined } };
    expect(canAssume(scaling, level(20))).toBe(false);
  });
});

describe("the beast's hit points", () => {
  const start = createPlayState();
  const shaped = assumeBeast(start, "srd51:monster/wolf", 11);

  it("replace the druid's while the shape lasts, and the druid's are not touched", () => {
    expect(shaped.wildShape).toEqual({ monster: "srd51:monster/wolf", hp: 11, max: 11 });
    const hurt = damageBeast({ ...shaped, hp: 20 }, 4);
    expect(hurt.play.wildShape?.hp).toBe(7);
    expect(hurt.play.hp).toBe(20);
    expect(hurt.overflow).toBe(0);
  });

  it("end the shape at 0 and pass the rest of the damage on to the druid", () => {
    const down = damageBeast(shaped, 15);
    expect(down.play.wildShape).toBeUndefined();
    expect(down.overflow).toBe(4);
    // Exactly the beast's hit points leave nothing over, and the druid returns all the same.
    const exact = damageBeast(shaped, 11);
    expect(exact.play.wildShape).toBeUndefined();
    expect(exact.overflow).toBe(0);
  });

  it("can be healed up to the maximum, and do nothing outside the shape", () => {
    const hurt = damageBeast(shaped, 6).play;
    expect(healBeast(hurt, 3).wildShape?.hp).toBe(8);
    expect(healBeast(hurt, 99).wildShape?.hp).toBe(11);
    expect(healBeast(start, 5)).toBe(start);
    expect(damageBeast(start, 5)).toEqual({ play: start, overflow: 5 });
    expect(leaveBeast(shaped).wildShape).toBeUndefined();
  });

  it("end with a long rest, not with a short one", () => {
    expect(shortRest(shaped, "none").wildShape).toBeDefined();
    expect(longRest(shaped, { d8: 3 }).wildShape).toBeUndefined();
  });

  it("are kept with the character", () => {
    const c = createCharacter("srd51");
    c.play = shaped;
    expect(parseCharacter(JSON.parse(JSON.stringify(c))).play.wildShape).toEqual(shaped.wildShape);
  });
});

describe("Combat Wild Shape of the Moon", () => {
  const shaped = assumeBeast(createPlayState(), "srd51:monster/wolf", 11);

  it("spends a slot and heals the beast by what was rolled, up to its maximum", () => {
    const hurt = damageBeast(shaped, 9).play;
    const healed = healWithSlot(hurt, 2, 3, 7);
    expect(healed.wildShape?.hp).toBe(9);
    expect(healed.slotsUsed[1]).toBe(1);
    expect(healWithSlot(hurt, 1, 2, 50).wildShape?.hp).toBe(11);
  });
});
