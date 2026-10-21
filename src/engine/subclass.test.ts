import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { classesNeedingSubclass } from "./subclass";

function make(classId: string, level: number, subclassId?: string) {
  const c = createCharacter("srd51");
  c.classes = [{ classId: `srd51:class/${classId}`, level, ...(subclassId && { subclassId }) }];
  return c;
}

describe("a subclass that is due", () => {
  it("is reported once the level that gives it is reached", () => {
    expect(classesNeedingSubclass(make("wizard", 1), srd51Index)).toEqual([]);
    expect(classesNeedingSubclass(make("wizard", 2), srd51Index)).toEqual(["srd51:class/wizard"]);
    expect(classesNeedingSubclass(make("cleric", 1), srd51Index)).toEqual(["srd51:class/cleric"]);
  });

  it("is not reported once one is chosen", () => {
    expect(
      classesNeedingSubclass(make("wizard", 5, "srd51:subclass/evocation"), srd51Index),
    ).toEqual([]);
  });

  it("is not asked before the level that gives it", () => {
    expect(classesNeedingSubclass(make("fighter", 1), srd51Index)).toEqual([]);
  });
});
