import { describe, expect, it } from "vitest";
import { createPlayState } from "../engine/character";
import { playStates, stateAttributes } from "./playStates";

describe("the states the play screen shows", () => {
  const calm = createPlayState();

  it("has none for a character in good health with nothing going on", () => {
    expect(playStates(calm, 20)).toEqual({});
  });

  it("says when the character is dying, stable or dead", () => {
    expect(playStates({ ...calm, hp: 0 }, 20).dying).toBe("dying");
    const stable = { ...calm, hp: 0, deathSaves: { successes: 3, failures: 0 } };
    expect(playStates(stable, 20).dying).toBe("stable");
    const dead = { ...calm, hp: 0, deathSaves: { successes: 0, failures: 3 } };
    expect(playStates(dead, 20).dying).toBe("dead");
    expect(playStates({ ...calm, hp: 1 }, 20).dying).toBeUndefined();
  });

  it("does not call a character with no hit points yet dying", () => {
    expect(playStates(calm, 0)).toEqual({});
  });

  it("notes concentration, inspiration and temporary hit points", () => {
    const busy = { ...calm, concentration: "srd51:spell/bless", inspiration: true, tempHp: 4 };
    expect(playStates(busy, 20)).toEqual({ focus: "on", inspired: "on", temp: "on" });
  });

  it("lists the conditions by their slug", () => {
    const hit = { ...calm, conditions: ["srd51:condition/poisoned", "srd51:condition/prone"] };
    expect(playStates(hit, 20).conditions).toBe("poisoned prone");
  });

  it("gives the styles an attribute for each state, and none for what is absent", () => {
    expect(stateAttributes(playStates(calm, 20))).toEqual({
      "data-dying": undefined,
      "data-focus": undefined,
      "data-inspired": undefined,
      "data-temp": undefined,
      "data-conditions": undefined,
    });
    expect(stateAttributes({ focus: "on" })["data-focus"]).toBe("on");
  });
});
