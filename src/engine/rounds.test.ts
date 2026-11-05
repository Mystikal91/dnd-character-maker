import { describe, expect, it } from "vitest";
import { createCharacter, createPlayState } from "./character";
import { parseCharacter } from "./characterSchema";
import { RAGE_ROUNDS, SHILLELAGH_ROUNDS, durationRounds } from "./durations";
import {
  MAX_ROUNDS,
  advanceRound,
  endConcentration,
  enterRage,
  longRest,
  roundsLeft,
  setRounds,
  setShillelagh,
  shortRest,
  startConcentration,
  toggleCondition,
} from "./play";

const frightened = "srd51:condition/frightened";
const poisoned = "srd51:condition/poisoned";
const withBoth = () => {
  let play = toggleCondition(toggleCondition(createPlayState(), frightened), poisoned);
  play = setRounds(setRounds(play, frightened, 1), poisoned, 3);
  return play;
};

describe("conditions that last a number of rounds", () => {
  it("keeps the rounds left, and none means no limit", () => {
    let play = toggleCondition(createPlayState(), frightened);
    expect(roundsLeft(play, frightened)).toBeUndefined();
    play = setRounds(play, frightened, 4);
    expect(roundsLeft(play, frightened)).toBe(4);
    expect(setRounds(play, frightened, 0).rounds).toBeUndefined();
    expect(setRounds(play, frightened, undefined).rounds).toBeUndefined();
    expect(roundsLeft(setRounds(play, frightened, 5000), frightened)).toBe(MAX_ROUNDS);
  });

  it("forgets the rounds of a condition that is taken off", () => {
    const play = toggleCondition(withBoth(), frightened);
    expect(play.conditions).toEqual([poisoned]);
    expect(play.rounds).toEqual({ [poisoned]: 3 });
    expect(toggleCondition(play, poisoned).rounds).toBeUndefined();
  });

  it("takes one round off each and ends the condition that has none left", () => {
    const first = advanceRound(withBoth());
    expect(first.ended).toEqual([frightened]);
    expect(first.play.conditions).toEqual([poisoned]);
    expect(first.play.rounds).toEqual({ [poisoned]: 2 });
    const second = advanceRound(advanceRound(first.play).play);
    expect(second.ended).toEqual([poisoned]);
    expect(second.play.conditions).toEqual([]);
    expect(second.play.rounds).toBeUndefined();
  });

  it("changes nothing for conditions with no limit", () => {
    const play = toggleCondition(createPlayState(), frightened);
    expect(advanceRound(play)).toEqual({ play, ended: [] });
  });

  it("does not touch the state it was given", () => {
    const play = withBoth();
    const before = structuredClone(play);
    advanceRound(play);
    expect(play).toEqual(before);
  });

  it("keeps the rounds through a long rest, as it keeps the conditions", () => {
    const rested = longRest(withBoth(), {});
    expect(rested.conditions).toEqual([frightened, poisoned]);
    expect(rested.rounds).toEqual({ [frightened]: 1, [poisoned]: 3 });
  });

  it("is saved with the character", () => {
    const c = createCharacter("srd51");
    c.play = withBoth();
    const back = parseCharacter(JSON.parse(JSON.stringify(c)));
    expect(back.play.rounds).toEqual({ [frightened]: 1, [poisoned]: 3 });
  });
});

describe("how many rounds a spell lasts", () => {
  it("reads the duration in any of the languages: a minute is ten rounds", () => {
    const cases: [string, number | undefined][] = [
      ["1 minute", 10],
      ["Up to 1 minute", 10],
      ["Up to 10 minutes", 100],
      ["1 round", 1],
      ["Concentrazione, fino a 1 minuto", 10],
      ["Concentrazione, fino a un minuto", 10],
      ["concentration, jusqu’à 10 minutes", 100],
      ["Konzentration, bis zu 1 Runde", 1],
      ["Concentración, hasta 1 asalto", 1],
      ["1 hour", undefined],
      ["Up to 8 hours", undefined],
      ["10 days", undefined],
      ["Instantaneous", undefined],
      ["Until dispelled", undefined],
      ["", undefined],
    ];
    for (const [text, rounds] of cases) expect(durationRounds(text), text).toBe(rounds);
  });
});

describe("what else runs by rounds", () => {
  const bless = "srd51:spell/bless";

  it("counts the rounds of a concentration, and ends it when they are over", () => {
    let play = startConcentration(createPlayState(), bless, 2);
    expect(play).toMatchObject({ concentration: bless, rounds: { concentration: 2 } });
    play = advanceRound(play).play;
    const last = advanceRound(play);
    expect(last.ended).toEqual(["concentration"]);
    expect(last.play.concentration).toBeUndefined();
    expect(last.play.rounds).toBeUndefined();
  });

  it("has no rounds for a concentration whose duration cannot be counted", () => {
    const play = startConcentration(createPlayState(), bless);
    expect(play.rounds).toBeUndefined();
    // A new concentration forgets the rounds of the old one.
    const first = startConcentration(createPlayState(), bless, 5);
    expect(startConcentration(first, "srd51:spell/haste").rounds).toBeUndefined();
  });

  it("takes the rounds away when the concentration ends by itself", () => {
    const play = startConcentration(createPlayState(), bless, 5);
    expect(endConcentration(play).rounds).toBeUndefined();
  });

  it("gives a rage and the cantrip Shillelagh a minute, and ends them with it", () => {
    const raging = enterRage(createPlayState());
    expect(raging.rounds).toEqual({ rage: RAGE_ROUNDS });
    let play = setShillelagh(raging, "srd51:item/club");
    expect(play.rounds).toEqual({ rage: RAGE_ROUNDS, shillelagh: SHILLELAGH_ROUNDS });
    for (let i = 0; i < 9; i++) play = advanceRound(play).play;
    expect(play.raging).toBe(true);
    const over = advanceRound(play);
    expect(over.ended.sort()).toEqual(["rage", "shillelagh"]);
    expect(over.play.raging).toBeUndefined();
    expect(over.play.shillelagh).toBeUndefined();
    expect(over.play.rounds).toBeUndefined();
  });

  it("drops the rounds of a rage and a cantrip at a rest, but keeps a concentration through a short one", () => {
    let play = enterRage(startConcentration(createPlayState(), bless, 8));
    play = setShillelagh(play, "srd51:item/club");
    expect(shortRest(play, "none").rounds).toEqual({ concentration: 8 });
    expect(longRest(play, {}).rounds).toBeUndefined();
  });

  it("keeps the rounds of the conditions through a long rest and drops the others", () => {
    let play = toggleCondition(startConcentration(createPlayState(), bless, 8), frightened);
    play = setRounds(play, frightened, 3);
    expect(longRest(play, {}).rounds).toEqual({ [frightened]: 3 });
  });
});
