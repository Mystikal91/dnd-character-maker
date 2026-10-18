import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LOCALES = "locales";
const read = (path: string) => JSON.parse(readFileSync(path, "utf-8")) as Record<string, string>;

const others = readdirSync(LOCALES).filter(
  (name) => name !== "en" && statSync(join(LOCALES, name)).isDirectory(),
);

describe("translated rules texts", () => {
  for (const locale of others) {
    const dir = join(LOCALES, locale, "srd51");
    let files: string[] = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    } catch {
      // This language has no rules texts yet.
    }

    for (const file of files) {
      it(`${locale}/${file} only has keys and placeholders-free texts that English also has`, () => {
        const english = read(join(LOCALES, "en", "srd51", file));
        const translated = read(join(dir, file));
        expect(Object.keys(translated).filter((key) => !(key in english))).toEqual([]);
        expect(Object.values(translated).filter((text) => text.trim() === "")).toEqual([]);
      });
    }
  }
});
