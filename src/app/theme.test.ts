import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, parseTheme, themeAttributes } from "./theme.logic";

describe("parseTheme", () => {
  it("falls back to the defaults for missing or malformed data", () => {
    expect(parseTheme(null)).toEqual(DEFAULT_THEME);
    expect(parseTheme("not json")).toEqual(DEFAULT_THEME);
    expect(parseTheme(JSON.stringify({ style: "neon", scheme: 3 }))).toEqual(DEFAULT_THEME);
  });

  it("keeps valid saved values", () => {
    expect(parseTheme(JSON.stringify({ style: "modern", scheme: "dark" }))).toEqual({
      style: "modern",
      scheme: "dark",
    });
    expect(parseTheme(JSON.stringify({ style: "fantasy", scheme: "light" }))).toEqual({
      style: "fantasy",
      scheme: "light",
    });
  });
});

describe("themeAttributes", () => {
  it("leaves the scheme unset for auto so CSS follows the device", () => {
    expect(themeAttributes({ style: "fantasy", scheme: "auto" })).toEqual({ style: "fantasy" });
  });

  it("sets an explicit scheme", () => {
    expect(themeAttributes({ style: "modern", scheme: "dark" })).toEqual({
      style: "modern",
      scheme: "dark",
    });
  });
});
