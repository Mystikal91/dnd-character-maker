// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadContent } from "../content/browser";
import { createCharacter, createPlayState } from "../engine/character";
import { parseCharacter } from "../engine/characterSchema";
import { longRest, setBardicDie, setInspiration } from "../engine/play";
import { addBardicDie, changePlay, rerollWithInspiration, rollCheck, rollLog } from "./play";
import { playStates } from "./playStates";
import { character, content } from "./store";

describe("the dice of Bardic Inspiration and the inspiration of the DM", () => {
  beforeAll(async () => {
    content.value = await loadContent(["en"]);
  });
  beforeEach(() => {
    const c = createCharacter("srd51");
    c.classes = [{ classId: "srd51:class/bard", level: 3 }];
    character.value = c;
    rollLog.value = [];
  });

  it("holds one die at a time, and lets go of it", () => {
    const held = setBardicDie(createPlayState(), 8);
    expect(held.bardicDie).toBe(8);
    expect(setBardicDie(held, 10).bardicDie).toBe(10);
    expect("bardicDie" in setBardicDie(held, undefined)).toBe(false);
    expect(setInspiration(createPlayState(), true).inspiration).toBe(true);
  });

  it("is kept in the saved character, and a long rest ends the die but not the inspiration", () => {
    const play = { ...setBardicDie(setInspiration(createPlayState(), true), 6) };
    expect(playStates(play, 10)).toMatchObject({ inspired: "on", bardic: "on" });
    const rested = longRest(play, {});
    expect(rested.inspiration).toBe(true);
    expect(rested.bardicDie).toBeUndefined();
    const doc = { ...createCharacter("srd51"), play };
    expect(parseCharacter(JSON.parse(JSON.stringify(doc))).play.bardicDie).toBe(6);
  });

  it("rolls a d20 again and spends the inspiration", () => {
    changePlay((p) => setInspiration(p, true));
    rollCheck("Perception", 4);
    const first = rollLog.value[0];
    expect(first?.redo).toBeDefined();
    if (first) rerollWithInspiration(first);
    expect(character.value.play.inspiration).toBe(false);
    expect(rollLog.value).toHaveLength(2);
    expect(rollLog.value[0]?.label).toContain("Perception");
    // Nothing is spent when there is no inspiration.
    const second = rollLog.value[0];
    if (second) rerollWithInspiration(second);
    expect(rollLog.value).toHaveLength(2);
  });

  it("adds the die to the total of the roll, once, and spends it", () => {
    changePlay((p) => setBardicDie(p, 8));
    rollCheck("Athletics", 2);
    const roll = rollLog.value[0];
    expect(roll?.total).toBeDefined();
    if (roll) addBardicDie(roll);
    const added = rollLog.value[0];
    expect(character.value.play.bardicDie).toBeUndefined();
    expect(added?.bardic).toBe(true);
    const gain = (added?.total ?? 0) - (roll?.total ?? 0);
    expect(gain).toBeGreaterThanOrEqual(1);
    expect(gain).toBeLessThanOrEqual(8);
    // A second try has no die left.
    if (added) addBardicDie(added);
    expect(rollLog.value).toHaveLength(2);
  });
});
