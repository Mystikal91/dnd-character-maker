import { describe, expect, it } from "vitest";
import { createCharacter } from "./character";
import { parseCharacter } from "./characterSchema";
import { NO_COINS, goldValue, withCoin } from "./coins";

describe("coins", () => {
  it("add up to gold pieces", () => {
    expect(goldValue(undefined)).toBe(0);
    expect(goldValue({ cp: 50, sp: 10, ep: 2, gp: 7, pp: 1 })).toBeCloseTo(0.5 + 1 + 1 + 7 + 10);
  });

  it("are set one kind at a time, as whole numbers of at least zero", () => {
    const coins = withCoin(undefined, "gp", 12.9);
    expect(coins).toEqual({ ...NO_COINS, gp: 12 });
    expect(withCoin(coins, "sp", -4)).toEqual({ ...NO_COINS, gp: 12, sp: 0 });
    expect(withCoin(coins, "cp", Number.NaN)).toEqual({ ...NO_COINS, gp: 12 });
  });

  it("are saved with the character, and a character without coins still loads", () => {
    const c = createCharacter("srd51");
    expect(parseCharacter(JSON.parse(JSON.stringify(c))).coins).toBeUndefined();
    c.coins = withCoin(undefined, "gp", 15);
    expect(parseCharacter(JSON.parse(JSON.stringify(c))).coins?.gp).toBe(15);
  });
});
