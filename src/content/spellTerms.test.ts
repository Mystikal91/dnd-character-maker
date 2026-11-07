import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { UserPackRecord } from "../storage/packs";
import { loadContent } from "./browser";
import { spellTerm } from "./spellTerms";

const read = (lang: string): Record<string, string> =>
  JSON.parse(readFileSync(`locales/${lang}/srd51/spells.json`, "utf8"));
const LANGUAGES = ["it", "fr", "de", "es"];

describe("a spell of an imported pack", () => {
  const record = (): UserPackRecord => ({
    id: "imp1",
    name: "Imported",
    origin: "personal",
    addedAt: 1,
    lang: "en",
    pack: {
      manifest: {
        id: "imp1",
        ruleset: "custom",
        version: "1",
        license: "Personal use",
        attribution: "Test",
      },
      entries: [{ id: "imp1:spell/glimmer", kind: "spell", effects: [], data: { level: 1 } }],
    },
    strings: {
      "imp1:spell/glimmer.castingTime": "1 Bonus Action",
      "imp1:spell/glimmer.duration": "Concentration, up to 1 minute",
      "imp1:spell/glimmer.range": "Self (15-foot cone)",
    },
  });

  it("shows its casting time and duration in the language of the app, without a machine", async () => {
    const it = await loadContent(["it", "en"], [record()]);
    expect(it.text("imp1:spell/glimmer", "castingTime")).toBe("1 azione bonus");
    expect(it.text("imp1:spell/glimmer", "duration")).toBe("Concentrazione, fino a 1 minuto");
    expect(it.displayed("imp1:spell/glimmer", "castingTime")).toBe("1 azione bonus");
    // A range that is not a standard word is not touched here (the units still follow the setting).
    expect(it.text("imp1:spell/glimmer", "range")).toContain("cone");
  });

  it("keeps the English words when the app is in English", async () => {
    const en = await loadContent(["en"], [record()]);
    expect(en.text("imp1:spell/glimmer", "castingTime")).toBe("1 Bonus Action");
  });
});

describe("the standard words of a spell", () => {
  it("are written as the translated SRD writes them", () => {
    const en = read("en");
    for (const lang of LANGUAGES) {
      const tr = read(lang);
      const wrong: string[] = [];
      let checked = 0;
      for (const [key, value] of Object.entries(en)) {
        const field = key.slice(key.lastIndexOf(".") + 1);
        if (!["castingTime", "duration", "range"].includes(field)) continue;
        // The English SRD says "Up to 1 hour" for what is a concentration in the book.
        const source =
          field === "duration" && value.startsWith("Up to")
            ? `Concentration, ${value.replace("Up", "up")}`
            : value;
        // The book adds the condition of a reaction to the casting time: only the bare words are ours.
        if (value === "1 reaction") continue;
        const got = spellTerm(field, source, lang);
        const book = tr[key]?.replace(/\.$/, "").toLowerCase();
        if (got === undefined || book === undefined) continue;
        checked++;
        // A spell may have its own variant in the book ("1 day" for 24 hours): the same words, at least.
        const variants = Object.entries(en)
          .filter(([k, v]) => k.endsWith(`.${field}`) && v === value)
          .map(([k]) => tr[k]?.replace(/\.$/, "").toLowerCase());
        if (!variants.includes(got.toLowerCase()))
          wrong.push(
            `${lang} ${field} "${value}" -> "${got}" (book: ${[...new Set(variants)].join(" / ")})`,
          );
      }
      expect(checked, lang).toBeGreaterThan(100);
      expect(wrong, lang).toEqual([]);
    }
  });

  it("read the capitals and the numbers of other tools", () => {
    expect(spellTerm("castingTime", "1 Action", "it")).toBe("1 azione");
    expect(spellTerm("castingTime", "2 Actions", "fr")).toBe("2 actions");
    expect(spellTerm("castingTime", "1 Bonus Action", "es")).toBe("1 acción adicional");
    expect(spellTerm("castingTime", "1 bonus action", "it")).toBe("1 azione bonus");
    expect(spellTerm("castingTime", "1 Reaction", "de")).toBe("1 Reaktion");
    expect(spellTerm("castingTime", "10 minutes", "de")).toBe("10 Minuten");
    expect(spellTerm("castingTime", "1 hour.", "es")).toBe("1 hora");
    expect(spellTerm("duration", "Instantaneous", "de")).toBe("Unmittelbar");
    expect(spellTerm("duration", "Concentration, up to 1 minute", "it")).toBe(
      "Concentrazione, fino a 1 minuto",
    );
    expect(spellTerm("duration", "Concentration, up to 10 minutes", "fr")).toBe(
      "concentration, jusqu’à 10 minutes",
    );
    expect(spellTerm("duration", "Up to 8 hours", "es")).toBe("Hasta 8 horas");
    expect(spellTerm("duration", "3 days", "de")).toBe("3 Tage");
    expect(spellTerm("duration", "1 round", "it")).toBe("1 round");
    expect(spellTerm("duration", "Until dispelled or triggered", "fr")).toBe(
      "jusqu’à dissipation ou activation",
    );
    expect(spellTerm("range", "Touch", "it")).toBe("Contatto");
    expect(spellTerm("range", "Self", "es")).toBe("Lanzador");
  });

  it("leave alone what is not a standard phrase, a field that is not one, and English", () => {
    expect(
      spellTerm("castingTime", "1 reaction, which you take when you are hit", "it"),
    ).toBeUndefined();
    expect(spellTerm("duration", "1 action", "it")).toBeUndefined();
    expect(spellTerm("range", "Self (15-foot cone)", "it")).toBeUndefined();
    expect(spellTerm("range", "60 feet", "it")).toBeUndefined();
    expect(spellTerm("name", "Instantaneous", "it")).toBeUndefined();
    expect(spellTerm("duration", "Instantaneous", "en")).toBeUndefined();
  });
});
