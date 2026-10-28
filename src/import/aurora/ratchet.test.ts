import { describe, expect, it } from "vitest";
import type { Entry } from "../../data/schema";
import { type Outcomes, countEffects, measure, toFile, worse } from "./ratchet";

const entry = (id: string, effects: Entry["effects"]): Entry => ({
  id,
  kind: "trait",
  effects,
  data: {},
});

describe("the baseline of what Aurora's elements turn into", () => {
  it("counts the effects inside a rule that depends on another as effects", () => {
    expect(
      countEffects([
        { type: "trait", id: "a:trait/x" },
        {
          type: "when",
          requires: "FLAG",
          effects: [
            { type: "modifier", target: "ac", value: 1 },
            { type: "modifier", target: "speed", value: 10 },
          ],
        },
      ]),
    ).toBe(3);
  });

  it("measures an element by the entry it became and the rules left out", () => {
    const entries = [
      entry("p:trait/a", [{ type: "trait", id: "p:trait/b" }]),
      entry("p:trait/c", []),
    ];
    const outcomes = measure(entries, { ID_B: "p:trait/c", ID_A: "p:trait/a" }, { ID_B: 2 });
    expect(outcomes).toEqual({ ID_A: [1, 0], ID_B: [0, 2] });
    expect(Object.keys(outcomes)).toEqual(["ID_A", "ID_B"]);
  });

  it("calls only what got worse a problem", () => {
    const baseline: Outcomes = { A: [2, 0], B: [1, 1], C: [3, 0], D: [1, 0] };
    const now: Outcomes = { A: [1, 0], B: [4, 0], C: [3, 2], E: [0, 5] };
    expect(worse(baseline, now)).toEqual([
      "A: 2 effects before, 1 now",
      "C: 0 rules left out before, 2 now",
      "D: no longer imported",
    ]);
  });

  it("writes one element to a line", () => {
    expect(toFile({ ID_A: [1, 0], ID_B: [0, 2] })).toBe(
      '{\n  "ID_A": [1, 0],\n  "ID_B": [0, 2]\n}\n',
    );
  });
});
