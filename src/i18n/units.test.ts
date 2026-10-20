import { describe, expect, it } from "vitest";
import { convertText, distance, weight } from "./units";

describe("units", () => {
  it("shows a speed in feet or meters", () => {
    expect(distance(30, false)).toBe("30 ft");
    expect(distance(30, true, "en")).toBe("9 m");
    expect(distance(25, true, "it")).toBe("7,5 m");
  });

  it("shows a weight in pounds or kilos", () => {
    expect(weight(12, false, "en")).toBe("12 lb");
    expect(weight(12, true, "en")).toBe("6 kg");
    expect(weight(5, true, "it")).toBe("2,5 kg");
  });

  it("converts the distances in an English text with the game's own ratio", () => {
    expect(convertText("Range 120 feet; 5-foot radius; 1,000 feet", true, "en")).toBe(
      "Range 36 m; 1.5 m radius; 300 m",
    );
    expect(convertText("Self (15-foot cone)", true, "it")).toBe("Self (4,5 m cone)");
    expect(convertText("It weighs 10 pounds and 2 lb, 2 miles away", true, "en")).toBe(
      "It weighs 5 kg and 1 kg, 3 km away",
    );
  });

  it("leaves other texts alone, and everything when units are imperial", () => {
    expect(convertText("Touch, 1 minute, 3 squares", true, "en")).toBe(
      "Touch, 1 minute, 3 squares",
    );
    expect(convertText("Un cono di 4,5 m", true, "it")).toBe("Un cono di 4,5 m");
    expect(convertText("120 feet", false, "en")).toBe("120 feet");
  });
});
