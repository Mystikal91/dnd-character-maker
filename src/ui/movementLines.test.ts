// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { movementLines } from "./movementLines";

describe("the lines of speeds and senses", () => {
  const movement = {
    climb: { feet: 15, half: true },
    swim: { feet: 40 },
    fly: { feet: 60 },
  };

  it("lists the speeds and the senses with their units", () => {
    expect(movementLines(movement, { darkvision: 60 })).toEqual([
      ["Climb", "15 ft (half speed)"],
      ["Swim", "40 ft"],
      ["Fly", "60 ft"],
      ["Darkvision", "60 ft"],
    ]);
  });

  it("leaves out the half speed of climbing and swimming when only what is given is wanted", () => {
    expect(movementLines(movement, {}, true)).toEqual([
      ["Swim", "40 ft"],
      ["Fly", "60 ft"],
    ]);
    expect(movementLines({ climb: { feet: 15, half: true } }, {}, true)).toEqual([]);
  });
});
