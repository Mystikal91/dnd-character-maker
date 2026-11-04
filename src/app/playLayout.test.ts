import { describe, expect, it } from "vitest";
import { canHide, keepHidden, moveTo, nudge, parseLayout } from "./playLayout";

const cols = () => [["a", "b", "c"], ["d", "e"], []];

describe("moving the panels of the Play screen", () => {
  it("puts a panel at an exact place and takes it out of where it was", () => {
    expect(moveTo(cols(), "a", 1, 1)).toEqual([["b", "c"], ["d", "a", "e"], []]);
    expect(moveTo(cols(), "e", 2, 0)).toEqual([["a", "b", "c"], ["d"], ["e"]]);
    // A place past the end is the end; a column that does not exist changes nothing.
    expect(moveTo(cols(), "a", 1, 9)).toEqual([["b", "c"], ["d", "e", "a"], []]);
    expect(moveTo(cols(), "a", 5, 0)).toEqual(cols());
  });

  it("steps up and down inside the column", () => {
    expect(nudge(cols(), "c", "up")).toEqual([["a", "c", "b"], ["d", "e"], []]);
    expect(nudge(cols(), "a", "down")).toEqual([["b", "a", "c"], ["d", "e"], []]);
    // At the ends it stays, and says so by returning the same columns.
    const same = cols();
    expect(nudge(same, "a", "up")).toBe(same);
    expect(nudge(same, "c", "down")).toBe(same);
  });

  it("goes past the panels that do not count, as on a phone where other parts are on other tabs", () => {
    const only = [["a", "x", "b", "y", "c"]];
    const mine = (other: string) => !["x", "y"].includes(other);
    expect(nudge(only, "a", "down", mine)).toEqual([["x", "b", "a", "y", "c"]]);
    expect(nudge(only, "c", "up", mine)).toEqual([["a", "x", "c", "b", "y"]]);
  });

  it("goes to the next column at the same height, or the end of a short one", () => {
    expect(nudge(cols(), "b", "right")).toEqual([["a", "c"], ["d", "b", "e"], []]);
    expect(nudge(cols(), "c", "right")).toEqual([["a", "b"], ["d", "e", "c"], []]);
    expect(nudge(cols(), "e", "right")).toEqual([["a", "b", "c"], ["d"], ["e"]]);
    const same = cols();
    expect(nudge(same, "a", "left")).toBe(same);
  });

  it("brings a hidden panel back to its old place when it is shown again", () => {
    const before = [["a", "h", "b"], ["d"]];
    const now = [["b", "a"], ["d"]];
    expect(keepHidden(before, now, ["h"])).toEqual([["b", "h", "a"], ["d"]]);
    expect(keepHidden(undefined, now, ["h"])).toEqual(now);
  });
});

describe("what is saved of the arrangement", () => {
  it("reads a good one", () => {
    const saved = { wanted: 2, layouts: { 2: [["a"], ["b"]] }, hidden: ["notes"] };
    expect(parseLayout(saved)).toEqual(saved);
  });

  it("trusts nothing: wrong shapes, wrong column counts and panels that cannot be hidden", () => {
    expect(parseLayout(null)).toEqual({ wanted: 3, layouts: {}, hidden: [] });
    expect(parseLayout("x")).toEqual({ wanted: 3, layouts: {}, hidden: [] });
    const odd = parseLayout({
      wanted: 7,
      layouts: { 2: [["a"]], 3: [["a"], "b", []], 1: [["a", 4]] },
      hidden: ["hp", "notes", "notes", 5],
    });
    expect(odd).toEqual({ wanted: 3, layouts: {}, hidden: ["notes"] });
  });

  it("keeps the panels the turn depends on from being hidden", () => {
    for (const panel of ["hp", "death", "attacks", "checks", "slots", "spells", "rests", "rage"]) {
      expect(canHide(panel), panel).toBe(false);
    }
    expect(canHide("notes")).toBe(true);
    expect(canHide("conditions")).toBe(true);
  });
});
