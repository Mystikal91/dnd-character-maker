import { describe, expect, it } from "vitest";
import en from "../../locales/en/ui.json";
import it_ from "../../locales/it/ui.json";
import { localeChain, pickLanguage } from "./language.logic";

describe("pickLanguage", () => {
  it("prefers the saved choice", () => {
    expect(pickLanguage("it", ["en-US"])).toBe("it");
  });

  it("uses the first supported browser language, ignoring the region", () => {
    expect(pickLanguage(null, ["fr-FR", "it-IT", "en"])).toBe("it");
  });

  it("falls back to English", () => {
    expect(pickLanguage("xx", ["fr", "de"])).toBe("en");
    expect(pickLanguage(undefined, [])).toBe("en");
  });
});

describe("localeChain", () => {
  it("puts English last so untranslated texts still show", () => {
    expect(localeChain("it")).toEqual(["it", "en"]);
    expect(localeChain("en")).toEqual(["en"]);
  });
});

describe("Italian interface texts", () => {
  const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  it("has no keys that English lacks", () => {
    const extra = Object.keys(it_).filter((key) => !(key in en));
    expect(extra).toEqual([]);
  });

  it("keeps the same placeholders as English", () => {
    const mismatched = Object.entries(it_).filter(
      ([key, text]) =>
        JSON.stringify(placeholders(text)) !==
        JSON.stringify(placeholders((en as Record<string, string>)[key] ?? "")),
    );
    expect(mismatched).toEqual([]);
  });
});
