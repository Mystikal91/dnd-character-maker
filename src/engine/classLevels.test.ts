import { describe, expect, it } from "vitest";
import { auditClassLevels } from "../test/classLevels";
import { srd51Index } from "../test/srd51";

describe("every SRD class and subclass, level 1 to 20, against its own table", () => {
  const { problems, sheets } = auditClassLevels(srd51Index);

  it("walks all 12 classes and their subclasses", () => {
    // 12 classes and 12 subclasses, 20 levels each.
    expect(sheets).toBe(24 * 20);
  });

  it("gets the features, bonus, spell slots and counters the table gives", () => {
    expect(problems).toEqual([]);
  });
});
