// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { damageName } from "./damageName";

describe("damageName", () => {
  it("says a usual kind of damage in the language, in lower case", () => {
    expect(damageName("bludgeoning")).toBe("bludgeoning");
    expect(damageName("slashing")).toBe("slashing");
  });

  it("leaves a kind it does not know as it is written", () => {
    expect(damageName("Bonus damage")).toBe("Bonus damage");
  });
});
