import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { srd51Index } from "../test/srd51";
import { type Character, createCharacter } from "./character";
import { deriveSheet } from "./derive";
import { checkNeeds, needsMet, needsOf } from "./optionNeeds";

const INVOCATIONS = "srd51:feature/eldritch-invocations/option";
const PACT = "srd51:feature/pact-boon/option";
const invocation = (name: string) => `srd51:feature/eldritch-invocation-${name}`;

function warlock(level: number): Character {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/human";
  c.classes = [{ classId: "srd51:class/warlock", level }];
  c.abilityBase = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 };
  return c;
}

const need = (level: number, option: string, c = warlock(level)) =>
  deriveSheet(c, srd51Index).choices.find((x) => x.key === INVOCATIONS)?.needs?.[option];

describe("what an option asks for", () => {
  it("reads the list of the SRD and the expression of Aurora", () => {
    const srd = srd51Index.get(invocation("thirsting-blade"));
    expect(needsOf(srd)).toBe("[level:5],srd51:feature/pact-of-the-blade");
    const aurora = {
      id: "x:feature/lash",
      kind: "feature",
      effects: [],
      data: { requires: "[level:5],(a||b)" },
    } as Entry;
    expect(needsOf(aurora)).toBe("[level:5],(a||b)");
    expect(needsOf(srd51Index.get(invocation("devils-sight")))).toBe("");
  });

  it("checks a level and what is held", () => {
    const state = { level: 5, held: new Set(["a"]) };
    expect(needsMet("[level:5],a", state)).toBe(true);
    expect(needsMet("[level:6],a", state)).toBe(false);
    expect(needsMet("[level:5],(b||a)", state)).toBe(true);
    expect(needsMet("[level:5],b", state)).toBe(false);
  });

  it("does not shut an option for words the app does not know", () => {
    const state = { level: 5, held: new Set<string>() };
    const knows = (id: string) => id === "known";
    // Only the twin from another edition is missing: nothing the person could get.
    expect(checkNeeds("known||twin24", { ...state, held: new Set(["known"]) }, knows).met).toBe(
      true,
    );
    expect(checkNeeds("twin24", state, knows).met).toBe(true);
    expect(checkNeeds("known", state, knows)).toEqual({ met: false, missing: [{ id: "known" }] });
    expect(checkNeeds("[level:9]", state, knows).missing).toEqual([{ level: 9 }]);
  });
});

describe("the invocations of the warlock", () => {
  it("asks for the level an invocation needs, and has it from that level", () => {
    expect(need(8, invocation("ascendant-step"))?.met).toBe(false);
    expect(need(9, invocation("ascendant-step"))?.met).toBe(true);
    expect(need(2, invocation("devils-sight"))).toBeUndefined();
  });

  it("asks for the cantrip, which is met once the warlock knows it", () => {
    expect(need(2, invocation("agonizing-blast"))?.met).toBe(false);
    const c = warlock(2);
    c.spells["srd51:class/warlock"] = {
      cantrips: ["srd51:spell/eldritch-blast"],
      known: [],
      prepared: [],
    };
    expect(need(2, invocation("agonizing-blast"), c)?.met).toBe(true);
  });

  it("asks for the pact, which is met once it is picked", () => {
    expect(need(3, invocation("book-of-ancient-secrets"))?.met).toBe(false);
    const c = warlock(3);
    c.selections[PACT] = ["srd51:feature/pact-of-the-tome"];
    expect(need(3, invocation("book-of-ancient-secrets"), c)?.met).toBe(true);
    expect(need(3, invocation("voice-of-the-chain-master"), c)?.met).toBe(false);
  });

  it("asks for both a level and a pact", () => {
    const c = warlock(12);
    c.selections[PACT] = ["srd51:feature/pact-of-the-blade"];
    expect(need(12, invocation("lifedrinker"), c)?.met).toBe(true);
    expect(
      need(11, invocation("lifedrinker"), {
        ...c,
        classes: [{ classId: "srd51:class/warlock", level: 11 }],
      })?.met,
    ).toBe(false);
  });

  it("warns about a pick whose cantrip the warlock does not know", () => {
    const c = warlock(2);
    c.selections[INVOCATIONS] = [invocation("agonizing-blast")];
    const sheet = deriveSheet(c, srd51Index);
    const warning = sheet.warnings.find((w) => w.code === "optionSpell");
    expect(warning?.params).toEqual({
      option: invocation("agonizing-blast"),
      spell: "srd51:spell/eldritch-blast",
    });
  });
});

describe("what a feat asks for", () => {
  it("writes the minimum score of the SRD as a word, and Aurora's own words say it all", () => {
    const grappler = {
      id: "x:feat/grappler",
      kind: "feat",
      effects: [],
      data: { prerequisites: [{ ability: "str", minimum: 13 }] },
    } as Entry;
    expect(needsOf(grappler)).toBe("[str:13]");
    const aurora = {
      id: "x:feat/grip",
      kind: "feat",
      effects: [],
      data: { prerequisites: [{ ability: "str", minimum: 13 }], requires: "[str:15]||UNLOCK" },
    } as Entry;
    expect(needsOf(aurora)).toBe("[str:15]||UNLOCK");
  });

  it("checks a minimum score when the scores are given, and not when they are not", () => {
    const state = { level: 4, held: new Set<string>() };
    const knows = () => false;
    expect(checkNeeds("[str:13]", { ...state, scores: { str: 12 } }, knows)).toEqual({
      met: false,
      missing: [{ ability: "str", minimum: 13 }],
    });
    expect(checkNeeds("[str:13]", { ...state, scores: { str: 13 } }, knows).met).toBe(true);
    expect(needsMet("[str:13]", state)).toBe(true);
  });

  it("reads the words of a book: the score is asked, the flags the app does not know are not", () => {
    const expression = "([str:13],!ID_PHB24_FEAT_GRAPPLER)||ID_GRANTS_FEAT_UNLOCKER";
    const knows = () => false;
    expect(
      checkNeeds(expression, { level: 1, held: new Set(), scores: { str: 10 } }, knows).met,
    ).toBe(false);
    expect(
      checkNeeds(expression, { level: 1, held: new Set(), scores: { str: 14 } }, knows).met,
    ).toBe(true);
  });

  it("tells what the character has, so a picker can check it", () => {
    const c = warlock(3);
    c.selections[PACT] = ["srd51:feature/pact-of-the-blade"];
    const held = deriveSheet(c, srd51Index).held;
    expect(held).toEqual(
      expect.arrayContaining(["srd51:class/warlock", "srd51:feature/pact-of-the-blade"]),
    );
  });
});
