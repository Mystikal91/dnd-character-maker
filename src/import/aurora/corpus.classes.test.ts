// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { parsePack } from "../../data/schema";
import { indexPacks } from "../../engine/derive";
import { auditClassLevels } from "../../test/classLevels";
import { srd51Index, srd51Packs } from "../../test/srd51";
import { DIR, available, nameOf, readElements } from "./corpusSuite";
import { parseAurora } from "./index";

/**
 * The same walk as for the SRD (`engine/classLevels.test.ts`) over every class and subclass that
 * Aurora's content adds, level 1 to 20, against the table each one carries. Without `AURORA_CORPUS`
 * it is skipped.
 */
describe.skipIf(!available)("every class and subclass of Aurora, level 1 to 20", () => {
  it("gets the features, bonus, spell slots and counters its table gives", () => {
    const result = parseAurora(readElements(DIR), {
      packId: "imp1",
      index: srd51Index,
      nameOf: nameOf(),
    });
    const pack = parsePack({
      manifest: { id: "imp1", ruleset: "custom", version: "1", license: "x", attribution: "x" },
      entries: result.entries,
    });
    const index = indexPacks(...srd51Packs, pack);
    const own = (e: { id: string }) => e.id.startsWith("imp1:");
    const { problems, sheets } = auditClassLevels(index, { classes: own, subclasses: own });
    console.log(`Aurora classes walked: ${sheets} sheets, ${problems.length} problems`);
    expect(sheets).toBeGreaterThan(100 * 20);
    expect(problems).toEqual([]);
  }, 600_000);
});
