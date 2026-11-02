// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCharacter } from "../engine/character";
import { addCompanion, removeCompanion, restoreCompanion } from "./companions";
import { askConfirm, confirmRequest } from "./confirm";
import { character } from "./store";
import { offerUndo, takeUndo, undoOffer } from "./undo";

describe("taking back what was just removed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    undoOffer.value = undefined;
  });
  afterEach(() => vi.useRealTimers());

  it("runs what puts it right, once, and the notice goes", async () => {
    const back = vi.fn();
    offerUndo("Removed", back);
    expect(undoOffer.value?.label).toBe("Removed");
    await takeUndo();
    await takeUndo();
    expect(back).toHaveBeenCalledTimes(1);
    expect(undoOffer.value).toBeUndefined();
  });

  it("is gone after a while, and a newer change replaces the older one", async () => {
    const first = vi.fn();
    const second = vi.fn();
    offerUndo("One", first);
    offerUndo("Two", second);
    expect(undoOffer.value?.label).toBe("Two");
    vi.advanceTimersByTime(11000);
    expect(undoOffer.value).toBeUndefined();
    await takeUndo();
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });

  it("puts a companion back where it was", () => {
    character.value = createCharacter("srd51");
    addCompanion("srd51:monster/wolf");
    addCompanion("srd51:monster/cat");
    addCompanion("srd51:monster/bat");
    const list = character.value.companions ?? [];
    const middle = list[1];
    expect(list).toHaveLength(3);
    if (!middle) return;
    removeCompanion(middle.id);
    expect(character.value.companions?.map((c) => c.monster)).toEqual([
      "srd51:monster/wolf",
      "srd51:monster/bat",
    ]);
    restoreCompanion(middle, 1);
    expect(character.value.companions?.map((c) => c.monster)).toEqual([
      "srd51:monster/wolf",
      "srd51:monster/cat",
      "srd51:monster/bat",
    ]);
    // Putting it back twice does not duplicate it.
    restoreCompanion(middle, 1);
    expect(character.value.companions).toHaveLength(3);
  });
});

describe("the question before what cannot be undone", () => {
  it("answers yes or no, and a new question answers the open one with no", async () => {
    const ask = () => askConfirm({ title: "Sure?", confirm: "Yes", cancel: "No" });
    const first = ask();
    confirmRequest.value?.answer(true);
    expect(await first).toBe(true);
    expect(confirmRequest.value).toBeUndefined();

    const open = ask();
    const next = ask();
    expect(await open).toBe(false);
    confirmRequest.value?.answer(false);
    expect(await next).toBe(false);
  });
});
