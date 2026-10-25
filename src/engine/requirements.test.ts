import { describe, expect, it } from "vitest";
import { type Effect, type Entry, parsePack } from "../data/schema";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { collectEffects } from "./choices";
import { deriveSheet } from "./derive";
import { evaluateRequirements, heldBy, plainEffects } from "./requirements";

const holding = (...words: string[]) => {
  const held = new Set(words);
  return (requirements: string) => evaluateRequirements(requirements, (w) => held.has(w));
};

describe("a requirement", () => {
  it("reads and, or, not and groups", () => {
    expect(holding("B")("!(A||B)")).toBe(false);
    expect(holding("C")("!(A||B)")).toBe(true);
    expect(holding("A")("A,!B")).toBe(true);
    expect(holding("A", "B")("A,!B")).toBe(false);
    expect(holding("B", "C")("(A||B),C")).toBe(true);
    expect(holding("B")("A||B,C")).toBe(false);
    expect(holding()("")).toBe(true);
  });

  it("takes a condition on the sheet as one word, which nothing holds yet", () => {
    expect(holding()("[str:13]")).toBe(false);
    expect(holding()("![str:13]")).toBe(true);
    expect(holding("ID_X")("ID_X,![innate speed:fly:1]")).toBe(true);
  });

  it("shows an entry as it stands before any choice", () => {
    const effects: Effect[] = [
      { type: "abilityBonus", ability: "str", value: 1 },
      {
        type: "when",
        requires: "!FLAG",
        effects: [{ type: "abilityBonus", ability: "cha", value: 2 }],
      },
      {
        type: "when",
        requires: "FLAG",
        effects: [{ type: "abilityBonus", ability: "dex", value: 1 }],
      },
    ];
    expect(plainEffects(effects)).toEqual([
      { type: "abilityBonus", ability: "str", value: 1 },
      { type: "abilityBonus", ability: "cha", value: 2 },
    ]);
    expect(plainEffects(effects, new Set(["FLAG"]))).toEqual([
      { type: "abilityBonus", ability: "str", value: 1 },
      { type: "abilityBonus", ability: "dex", value: 1 },
    ]);
  });
});

const entry = (id: string, kind: Entry["kind"], effects: Effect[], parent?: string): Entry => ({
  id,
  kind,
  effects,
  data: {},
  ...(parent && { parent }),
});

const race = entry("test:species/fiend", "species", [
  { type: "abilityBonus", ability: "int", value: 1 },
  {
    type: "when",
    requires: "!LINE",
    effects: [{ type: "abilityBonus", ability: "cha", value: 2 }],
  },
]);
const line = entry(
  "test:subspecies/line",
  "subspecies",
  [
    { type: "flag", id: "LINE" },
    { type: "abilityBonus", ability: "cha", value: 1 },
  ],
  race.id,
);
// A trait that sets the flag, and a sub-race that grants the trait: the flag arrives one step
// later than the entry that is chosen.
const marked = entry("test:trait/marked", "trait", [{ type: "flag", id: "LINE" }]);
const viaTrait = entry(
  "test:subspecies/via-trait",
  "subspecies",
  [{ type: "trait", id: marked.id }],
  race.id,
);
// A rule that asks for an entry by its id, such as a class.
const forFighters = entry("test:trait/fighters", "trait", [
  {
    type: "when",
    requires: "srd51:class/fighter",
    effects: [{ type: "abilityBonus", ability: "str", value: 1 }],
  },
]);

const index = new Map<string, Entry>([
  ...srd51Index,
  ...[race, line, marked, viaTrait, forFighters].map((e): [string, Entry] => [e.id, e]),
]);

const bonuses = (...entries: Entry[]) =>
  collectEffects(entries, { index, selections: {}, warnings: [] })
    .effects.flatMap((e) => (e.type === "abilityBonus" ? [e.ability + e.value] : []))
    .sort();

describe("effects behind a requirement", () => {
  it("count while it holds and give way to the flag a sub-race sets", () => {
    expect(bonuses(race)).toEqual(["cha2", "int1"]);
    expect(bonuses(race, line)).toEqual(["cha1", "int1"]);
  });

  it("see a flag set by a trait that is granted", () => {
    expect(bonuses(race, viaTrait)).toEqual(["int1"]);
  });

  it("see the class of the character", () => {
    const none = collectEffects([forFighters], { index, selections: {}, warnings: [] });
    expect(none.effects).toEqual([]);
    const fighter = collectEffects([forFighters], { index, selections: {}, warnings: [] }, [
      "srd51:class/fighter",
    ]);
    expect(fighter.effects).toEqual([{ type: "abilityBonus", ability: "str", value: 1 }]);
  });

  it("do not repeat a warning because the walk was made twice", () => {
    const warnings: never[] = [];
    const lost = entry("test:trait/lost", "trait", [{ type: "trait", id: "test:trait/missing" }]);
    collectEffects([race, line, lost], { index, selections: {}, warnings });
    expect(warnings).toHaveLength(1);
  });

  it("reach the sheet", () => {
    const c = createCharacter("srd51");
    c.choices.species = race.id;
    c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
    expect(deriveSheet(c, index).abilities.cha.bonus).toBe(2);
    c.choices.subspecies = line.id;
    const sheet = deriveSheet(c, index);
    expect(sheet.abilities.cha.bonus).toBe(1);
    expect(sheet.abilities.int.bonus).toBe(1);
  });

  it("are told apart by the entry that sets them", () => {
    expect([...heldBy(line.id, line.effects)].sort()).toEqual(["LINE", line.id].sort());
  });

  it("pass the pack schema, nested", () => {
    const pack = parsePack({
      manifest: { id: "test", ruleset: "custom", version: "1", license: "x", attribution: "x" },
      entries: [race, line],
    });
    expect(pack.entries[0]?.effects[1]).toMatchObject({ type: "when", requires: "!LINE" });
    expect(() =>
      parsePack({
        manifest: { id: "test", ruleset: "custom", version: "1", license: "x", attribution: "x" },
        entries: [
          entry("test:trait/bad", "trait", [
            { type: "when", requires: "X", effects: [{ type: "nope" } as never] },
          ]),
        ],
      }),
    ).toThrow();
  });
});
