import { describe, expect, it } from "vitest";
import { appendLine, backgroundSuggestions } from "./suggestions";

const texts: Record<string, string> = {
  "srd51:background/acolyte.ideals.1": "Tradition.",
  "srd51:background/acolyte.ideals.2": "Charity.",
  "srd51:background/acolyte.ideals.3": "Change.",
};
const textOf = (id: string, field: string) => texts[`${id}.${field}`];

describe("backgroundSuggestions", () => {
  it("collects the numbered options in order until one is missing", () => {
    expect(backgroundSuggestions(textOf, "srd51:background/acolyte", "ideals")).toEqual([
      "Tradition.",
      "Charity.",
      "Change.",
    ]);
  });

  it("is empty without a background or without options", () => {
    expect(backgroundSuggestions(textOf, undefined, "ideals")).toEqual([]);
    expect(backgroundSuggestions(textOf, "srd51:background/acolyte", "bonds")).toEqual([]);
  });
});

describe("appendLine", () => {
  it("starts a text, then adds each line on its own row", () => {
    expect(appendLine("", "A")).toBe("A");
    expect(appendLine("A", "B")).toBe("A\nB");
    expect(appendLine("A\n\n", "B")).toBe("A\nB");
  });

  it("does not add the same line twice", () => {
    expect(appendLine("A\nB", "A")).toBe("A\nB");
  });
});
