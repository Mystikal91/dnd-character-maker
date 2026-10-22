import { describe, expect, it } from "vitest";
import { nextEditStrings } from "./quickEdit.logic";

const base = (field: string) => ({ name: "Fireball", desc: "A bright streak." })[field];

describe("saving a quick edit", () => {
  it("keeps only what differs from the original", () => {
    const next = nextEditStrings(
      {},
      "srd51:spell/fireball",
      { name: "Palla di fuoco", desc: "A bright streak." },
      base,
    );
    expect(next).toEqual({ "srd51:spell/fireball.name": "Palla di fuoco" });
  });

  it("goes back to the original when a text is empty or the same again", () => {
    const current = {
      "srd51:spell/fireball.name": "Palla di fuoco",
      "srd51:spell/fireball.desc": "Una scia luminosa.",
      "other:spell/x.name": "Altro",
    };
    const next = nextEditStrings(
      current,
      "srd51:spell/fireball",
      { name: "  ", desc: "A bright streak." },
      base,
    );
    expect(next).toEqual({ "other:spell/x.name": "Altro" });
  });

  it("trims the text and adds a field that had no original", () => {
    const next = nextEditStrings(
      {},
      "a:b/c",
      { flavor: "  Un sapore\r\nnuovo  " },
      () => undefined,
    );
    expect(next).toEqual({ "a:b/c.flavor": "Un sapore\nnuovo" });
  });
});
