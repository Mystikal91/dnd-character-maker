// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { loadContent } from "../content/browser";
import { createCharacter } from "../engine/character";
import { currentHp } from "../engine/play";
import { changePlay, damageCharacter, hpUndo, undoHp, vitals } from "./play";
import { character, content } from "./store";

describe("taking back a change of hit points", () => {
  beforeAll(async () => {
    content.value = await loadContent(["en"]);
    const c = createCharacter("srd51");
    c.classes = [{ classId: "srd51:class/fighter", level: 3 }];
    character.value = c;
  });

  it("offers to undo damage and puts the hit points back", () => {
    const max = vitals()?.max ?? 0;
    expect(max).toBeGreaterThan(8);
    damageCharacter(5);
    expect(currentHp(character.value.play, max)).toBe(max - 5);
    expect(hpUndo.value?.change).toBe(-5);
    undoHp();
    expect(currentHp(character.value.play, max)).toBe(max);
    expect(hpUndo.value).toBeUndefined();
  });

  it("takes back a quick run of changes as one", () => {
    const max = vitals()?.max ?? 0;
    hpUndo.value = undefined;
    damageCharacter(1);
    damageCharacter(1);
    damageCharacter(1);
    expect(currentHp(character.value.play, max)).toBe(max - 3);
    expect(hpUndo.peek()?.change).toBe(-3);
    undoHp();
    expect(currentHp(character.value.play, max)).toBe(max);
  });

  it("does not offer anything for a change that is not about hit points", () => {
    hpUndo.value = undefined;
    changePlay((p) => ({ ...p, inspiration: true }));
    expect(hpUndo.value).toBeUndefined();
  });
});
