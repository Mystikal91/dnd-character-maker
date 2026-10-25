import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Entry, type Pack, findBrokenReferences, parsePack } from "../../data/schema";
import { createCharacter } from "../../engine/character";
import { deriveSheet, indexPacks } from "../../engine/derive";
import { SRD51_FILES, loadSrd51Strings, srd51Index, srd51Packs } from "../../test/srd51";
import { type AuroraResult, parseAurora } from "./index";

/**
 * The importer against the whole of Aurora's content, kept at a fixed commit (see the workflow).
 * Without `AURORA_CORPUS` (a folder with a copy of the elements) the tests are skipped, so the
 * ordinary `npm test` stays offline; `npm run test:corpus` runs them.
 */
const DIR = process.env.AURORA_CORPUS ?? "";

function collect(dir: string, found: string[] = []): string[] {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (item.name.startsWith(".")) continue;
    const path = join(dir, item.name);
    if (item.isDirectory()) collect(path, found);
    else if (/\.xml$|_xml$/.test(item.name)) found.push(path);
  }
  return found;
}

/** Core and supplements are what the app offers to import; the other folders are left out. */
function readElements(dir: string): string[] {
  const parts = ["core", "supplements"].map((n) => join(dir, n)).filter((p) => existsSync(p));
  return (parts.length > 0 ? parts : [dir])
    .flatMap((p) => collect(p))
    .map((path) => readFileSync(path, "utf8").replace(/^﻿/, ""))
    .filter((text) => {
      const doc = new DOMParser().parseFromString(text, "text/xml");
      return (
        doc.getElementsByTagName("parsererror").length === 0 &&
        doc.documentElement?.tagName === "elements"
      );
    });
}

function nameOf() {
  const names = new Map<string, string>();
  const loaded = SRD51_FILES.map(loadSrd51Strings);
  for (const [id, entry] of srd51Index) {
    const key = `${id.split("/")[1]}.name`;
    names.set(id, loaded.find((s) => s[key])?.[key] ?? entry.id);
  }
  return (id: string) => names.get(id) ?? id;
}

const available = Boolean(DIR) && existsSync(DIR);

/**
 * The content is read in the order it is listed or in reverse (a file of its own for each, so
 * that only one reading is in memory): which of two races that are the same one of the app
 * comes first must not matter.
 */
export function corpusSuite(reverse: boolean) {
  describe.skipIf(!available)(
    `the whole of Aurora's content, ${reverse ? "in reverse order" : "as listed"}`,
    () => {
      const listed = available ? readElements(DIR) : [];
      const files = reverse ? [...listed].reverse() : listed;
      let result = undefined as unknown as AuroraResult;
      let pack = undefined as unknown as Pack;
      let index = new Map<string, Entry>();
      let subs: Entry[] = [];
      beforeAll(() => {
        result = parseAurora(files, { packId: "imp1", index: srd51Index, nameOf: nameOf() });
        pack = parsePack({
          manifest: { id: "imp1", ruleset: "custom", version: "1", license: "x", attribution: "x" },
          entries: result.entries,
        });
        index = indexPacks(...srd51Packs, pack);
        subs = result.entries.filter((e) => e.kind === "subspecies");
      }, 120_000);
      afterAll(() => {
        result = undefined as unknown as AuroraResult;
        pack = undefined as unknown as Pack;
        index = new Map();
        subs = [];
      });

      /** The ability bonuses a sub-species gives with its species, as `{ str: 0, ... }`. */
      const bonuses = (sub: Entry) => {
        const c = createCharacter("srd51");
        c.choices.species = sub.parent ?? "";
        c.choices.subspecies = sub.id;
        const sheet = deriveSheet(c, index);
        return Object.fromEntries(Object.entries(sheet.abilities).map(([k, a]) => [k, a.bonus]));
      };
      const one = (id: string) => {
        const sub = subs.find((e) => e.id === id);
        if (!sub) throw new Error(`missing ${id}`);
        return bonuses(sub);
      };
      it("reads every file into a pack that passes the schema", () => {
        expect(files.length).toBeGreaterThan(500);
        expect(result.entries.length).toBeGreaterThan(4500);
        // Rules that depend on other rules stay in the pack and are checked with the sheet.
        const whens = JSON.stringify(result.entries).match(/"type":"when"/g) ?? [];
        expect(whens.length).toBeGreaterThan(300);
      });

      it("points only at entries that exist", () => {
        expect(findBrokenReferences([pack, ...srd51Packs])).toEqual([]);
      });

      it("gives no sub-species more fixed ability increases than the books do", () => {
        const heavy = subs
          .map((s) => ({
            id: s.id,
            total: Object.values(bonuses(s)).reduce((sum, n) => sum + Math.max(0, n), 0),
          }))
          .filter((s) => s.total > 4);
        expect(heavy).toEqual([]);
      });

      it("gives the Tiefling bloodlines Charisma +2 and their own increase, once", () => {
        const line = (id: string) => one(`imp1:subspecies/tiefling-${id}`);
        expect(line("asmodeus")).toMatchObject({ int: 1, cha: 2 });
        expect(line("baalzebub")).toMatchObject({ int: 1, cha: 2 });
        expect(line("dispater")).toMatchObject({ dex: 1, int: 0, cha: 2 });
        expect(line("fierna")).toMatchObject({ wis: 1, int: 0, cha: 2 });
        expect(line("glasya")).toMatchObject({ dex: 1, int: 0, cha: 2 });
        expect(line("levistus")).toMatchObject({ con: 1, int: 0, cha: 2 });
        expect(line("mammon")).toMatchObject({ int: 1, cha: 2 });
        expect(line("mephistopheles")).toMatchObject({ int: 1, cha: 2 });
        expect(line("zariel")).toMatchObject({ str: 1, int: 0, cha: 2 });
        expect(one("imp1:subspecies/feral-tiefling")).toMatchObject({ dex: 2, int: 1, cha: 0 });
      });

      it("gives the half-elf descents only the Charisma increase", () => {
        for (const id of ["wood-elf", "moon-elf", "sun-elf", "drow"])
          expect(one(`imp1:subspecies/${id}-descent`)).toMatchObject({ cha: 2, str: 0, dex: 0 });
      });

      it("gives the aasimar their own increases", () => {
        expect(one("imp1:subspecies/protector-aasimar")).toMatchObject({ wis: 1, cha: 2 });
        expect(one("imp1:subspecies/scourge-aasimar")).toMatchObject({ con: 1, cha: 2 });
        expect(one("imp1:subspecies/fallen-aasimar")).toMatchObject({ str: 1, cha: 2 });
      });

      it("derives every sub-species without trouble", () => {
        for (const sub of subs) expect(() => bonuses(sub)).not.toThrow();
      });
    },
    120_000,
  );
}
