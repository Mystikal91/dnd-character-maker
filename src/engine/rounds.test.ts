import { describe, expect, it } from "vitest";
import { createCharacter, createPlayState } from "./character";
import { parseCharacter } from "./characterSchema";
import { MAX_ROUNDS, advanceRound, longRest, roundsLeft, setRounds, toggleCondition } from "./play";

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
    expect(roundsLeft(setRounds(play, frightened, 500), frightened)).toBe(MAX_ROUNDS);
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
