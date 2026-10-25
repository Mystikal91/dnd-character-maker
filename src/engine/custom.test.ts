import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { parseCharacter } from "./characterSchema";
import { customResources, newCustomFeature } from "./custom";
import { deriveSheet } from "./derive";
import { resourceLeft, setResourceUsed, shortRest } from "./play";

describe("custom features", () => {
  it("make resources only when they have a limit", () => {
    const boon = { ...newCustomFeature(), name: "Boon", uses: 3, recharge: "short" as const };
    const free = { ...newCustomFeature(), name: "Free" };
    const pool = { ...newCustomFeature(), name: "Pool", uses: 20 };
    const made = customResources([boon, free, pool]);
    expect(made.map((r) => [r.name, r.max, r.recovery, r.pool])).toEqual([
      ["Boon", 3, "short", undefined],
      ["Pool", 20, "long", true],
    ]);
  });

  it("are ticked off in play and come back with the rest they name", () => {
    const c = createCharacter("srd51");
    c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
    c.custom = [{ id: "a1", name: "Boon", text: "A gift.", uses: 2, recharge: "short" }];
    const sheet = deriveSheet(c, srd51Index);
    const boon = sheet.resources.find((r) => r.id === "custom:a1");
    expect(boon).toMatchObject({ name: "Boon", max: 2, recovery: "short" });
    const spent = setResourceUsed(c.play, "custom:a1", 2, 2);
    expect(resourceLeft(spent, "custom:a1", 2)).toBe(0);
    const rested = shortRest(spent, "none", ["custom:a1"]);
    expect(resourceLeft(rested, "custom:a1", 2)).toBe(2);
  });

  it("are kept with the character", () => {
    const c = createCharacter("srd51");
    c.custom = [{ id: "a1", name: "Boon", text: "A gift.", uses: 2, recharge: "long" }];
    expect(parseCharacter(JSON.parse(JSON.stringify(c))).custom).toEqual(c.custom);
    // Characters saved before have none.
    expect(parseCharacter(JSON.parse(JSON.stringify(createCharacter("srd51")))).custom).toBe(
      undefined,
    );
  });
});
