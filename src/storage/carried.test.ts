import { describe, expect, it } from "vitest";
import { createCharacter } from "../engine/character";
import { carriedPacks, homebrewUsedBy, mergeCarried } from "./carried";
import type { UserPackRecord } from "./packs";
import { parseImportFile, serializeCharacter } from "./transfer";

const pack = (
  id: string,
  entries: { id: string; kind: "spell" | "class"; data?: Record<string, unknown> }[],
  over: Partial<UserPackRecord> = {},
): UserPackRecord => ({
  id,
  name: id,
  origin: "homebrew",
  addedAt: 1,
  lang: "en",
  pack: {
    manifest: { id, ruleset: "custom", version: "1", license: "x", attribution: "x" },
    entries: entries.map((e) => ({ ...e, effects: [], data: e.data ?? {} })) as never,
  },
  strings: Object.fromEntries(entries.map((e) => [`${e.id}.name`, e.id])),
  ...over,
});

const spells = pack("hbmyspells", [{ id: "hbmyspells:spell/dust", kind: "spell" }]);
const other = pack("hbother", [{ id: "hbother:spell/mote", kind: "spell" }]);
const aurora = pack("impx", [{ id: "impx:spell/glimmer", kind: "spell" }], { origin: "personal" });

describe("the homebrew a character uses", () => {
  it("is only the packs it refers to, never the ones from Aurora", () => {
    const c = createCharacter("srd51");
    c.spells["srd51:class/wizard"] = {
      cantrips: [],
      known: ["hbmyspells:spell/dust", "impx:spell/glimmer"],
      prepared: [],
    };
    expect(homebrewUsedBy(c, [spells, other, aurora]).map((p) => p.id)).toEqual(["hbmyspells"]);
  });

  it("follows a pack that needs another", () => {
    const needy = pack("hbneedy", [
      { id: "hbneedy:class/mage", kind: "class", data: { list: "hbother:spell/mote" } },
    ]);
    const c = createCharacter("srd51");
    c.classes = [{ classId: "hbneedy:class/mage", level: 1 }];
    expect(
      homebrewUsedBy(c, [needy, other, spells])
        .map((p) => p.id)
        .sort(),
    ).toEqual(["hbneedy", "hbother"]);
  });

  it("travels in the character file and comes out of it", () => {
    const c = createCharacter("srd51");
    const text = serializeCharacter(c, [spells]);
    const read = parseImportFile(text);
    expect(read.packs.map((p) => p.id)).toEqual(["hbmyspells"]);
    expect(read.character.id).not.toBe(c.id);
    // A file without packs has none, and a bad pack does not stop the character opening.
    expect(parseImportFile(serializeCharacter(c)).packs).toEqual([]);
    expect(carriedPacks({ homebrew: [{ nonsense: true }, spells] })).toHaveLength(1);
  });

  it("is added when the device lacks it, and fills in what is missing otherwise", () => {
    expect(mergeCarried(undefined, spells)).toMatchObject({ added: 1 });
    const richer = pack("hbmyspells", [
      { id: "hbmyspells:spell/dust", kind: "spell" },
      { id: "hbmyspells:spell/ash", kind: "spell" },
    ]);
    const merged = mergeCarried(spells, richer);
    expect(merged.added).toBe(1);
    expect(merged.record.pack.entries.map((e) => e.id)).toEqual([
      "hbmyspells:spell/dust",
      "hbmyspells:spell/ash",
    ]);
    expect(merged.record.strings["hbmyspells:spell/ash.name"]).toBe("hbmyspells:spell/ash");
    // What is here is not overwritten.
    const edited = { ...spells, strings: { "hbmyspells:spell/dust.name": "Mine" } };
    expect(mergeCarried(edited, richer).record.strings["hbmyspells:spell/dust.name"]).toBe("Mine");
    expect(mergeCarried(spells, spells).added).toBe(0);
  });
});
