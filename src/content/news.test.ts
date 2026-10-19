import { describe, expect, it } from "vitest";
import { LANGUAGES } from "../app/language.logic";
import { CHANGELOG, ROADMAP, pick } from "./news";

describe("changelog and roadmap", () => {
  it("lists versions once, newest first, with a date and English text", () => {
    expect(new Set(CHANGELOG.map((e) => e.version)).size).toBe(CHANGELOG.length);
    const dates = CHANGELOG.map((e) => e.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    for (const entry of CHANGELOG) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.notes.length).toBeGreaterThan(0);
      for (const note of entry.notes) expect(note.en.trim()).not.toBe("");
    }
  });

  it("only uses the languages the app has", () => {
    const codes = new Set<string>(LANGUAGES.map((l) => l.code));
    for (const text of [...CHANGELOG.flatMap((e) => e.notes), ...ROADMAP.map((r) => r.text)])
      for (const code of Object.keys(text)) expect(codes.has(code)).toBe(true);
  });

  it("falls back to English where a language is missing", () => {
    expect(pick({ en: "Hello", it: "Ciao" }, "it")).toBe("Ciao");
    expect(pick({ en: "Hello" }, "de")).toBe("Hello");
  });

  it("gives every roadmap item its own id", () => {
    expect(new Set(ROADMAP.map((r) => r.id)).size).toBe(ROADMAP.length);
  });
});
