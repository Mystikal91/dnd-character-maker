import { describe, expect, it } from "vitest";
import { squareCrop } from "./portrait";

describe("squareCrop", () => {
  it("takes the middle of a wide picture", () => {
    expect(squareCrop(400, 200)).toEqual({ x: 100, y: 0, side: 200 });
  });

  it("takes the middle of a tall picture", () => {
    expect(squareCrop(200, 500)).toEqual({ x: 0, y: 150, side: 200 });
  });

  it("keeps a square one whole", () => {
    expect(squareCrop(300, 300)).toEqual({ x: 0, y: 0, side: 300 });
  });
});
