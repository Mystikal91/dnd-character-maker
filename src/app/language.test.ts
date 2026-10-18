import { describe, expect, it } from "vitest";
import de from "../../locales/de/ui.json";
import en from "../../locales/en/ui.json";
import es from "../../locales/es/ui.json";
import fr from "../../locales/fr/ui.json";
import it_ from "../../locales/it/ui.json";
import { LANGUAGES, localeChain, pickLanguage } from "./language.logic";

describe("pickLanguage", () => {
  it("prefers the saved choice", () => {
    expect(pickLanguage("it", ["en-US"])).toBe("it");
  });

  it("uses the first supported browser language, ignoring the region", () => {
    expect(pickLanguage(null, ["pt-BR", "de-AT", "en"])).toBe("de");
  });

  it("falls back to English", () => {
    expect(pickLanguage("xx", ["pt", "ja"])).toBe("en");
    expect(pickLanguage(undefined, [])).toBe("en");
  });
});

describe("localeChain", () => {
  it("puts English last so untranslated texts still show", () => {
    expect(localeChain("it")).toEqual(["it", "en"]);
    expect(localeChain("en")).toEqual(["en"]);
  });
});

describe("interface texts", () => {
  const texts: Record<string, Record<string, string>> = { it: it_, fr, de, es };
  const english: Record<string, string> = en;
  const placeholders = (text: string) =>
    JSON.stringify([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort());

  it("covers every language the selector offers", () => {
    const offered = LANGUAGES.map((l) => l.code).filter((code) => code !== "en");
    expect(Object.keys(texts).sort()).toEqual([...offered].sort());
  });

  for (const [code, strings] of Object.entries(texts)) {
    it(`${code} has the same keys as English`, () => {
      expect(Object.keys(strings).filter((key) => !(key in english))).toEqual([]);
      expect(Object.keys(english).filter((key) => !(key in strings))).toEqual([]);
    });

    it(`${code} keeps the same placeholders as English`, () => {
      const mismatched = Object.entries(strings).filter(
        ([key, text]) => placeholders(text) !== placeholders(english[key] ?? ""),
      );
      expect(mismatched).toEqual([]);
    });
  }
});
