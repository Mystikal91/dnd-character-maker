import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { loadContent } from "../content/browser";
import {
  PackParseError,
  type UserPackRecord,
  deleteUserPack,
  listUserPacks,
  packFileName,
  parsePackFile,
  parseUserPack,
  saveUserPack,
  serializePack,
} from "./packs";

function record(over: Partial<UserPackRecord> = {}): UserPackRecord {
  return {
    id: "mine",
    name: "My Spells",
    origin: "homebrew",
    addedAt: 1,
    lang: "en",
    pack: {
      manifest: {
        id: "mine",
        ruleset: "custom",
        version: "1.0.0",
        license: "Own work",
        attribution: "By me",
      },
      entries: [
        {
          id: "mine:spell/glow",
          kind: "spell",
          effects: [],
          data: { level: 1, school: "evocation", classes: ["srd51:class/wizard"] },
        },
      ],
    },
    strings: { "mine:spell/glow.name": "Glow", "mine:spell/glow.desc": "A soft light." },
    ...over,
  };
}

describe("user packs in storage", () => {
  it("saves, lists and deletes", async () => {
    await saveUserPack(record());
    await saveUserPack(
      record({
        id: "other",
        name: "Another",
        pack: {
          ...record().pack,
          manifest: { ...record().pack.manifest, id: "other" },
          entries: [],
        },
      }),
    );
    expect((await listUserPacks()).map((p) => p.name)).toEqual(["Another", "My Spells"]);
    await deleteUserPack("other");
    await deleteUserPack("mine");
    expect(await listUserPacks()).toEqual([]);
  });

  it("refuses ids that belong to the content shipped with the app", () => {
    const bad = record({ id: "srd51" });
    bad.pack = { ...bad.pack, manifest: { ...bad.pack.manifest, id: "srd51" }, entries: [] };
    expect(() => parseUserPack(bad)).toThrow(PackParseError);
  });

  it("refuses a record whose id differs from its pack", () => {
    expect(() => parseUserPack(record({ id: "different" }))).toThrow(PackParseError);
  });
});

describe("pack files", () => {
  it("round-trips a homebrew pack and drops where it came from", () => {
    const text = serializePack(record());
    const back = parsePackFile(text, 99);
    expect(back).toMatchObject({ id: "mine", name: "My Spells", origin: "homebrew", addedAt: 99 });
    expect(back.strings["mine:spell/glow.name"]).toBe("Glow");
    expect(packFileName(record())).toBe("my-spells.dndpack.json");
  });

  it("never exports a personal pack", () => {
    expect(() => serializePack(record({ origin: "personal" }))).toThrow(PackParseError);
  });

  it("always reads a file as homebrew, even if it claims otherwise", () => {
    const claimed = JSON.parse(serializePack(record()));
    claimed.origin = "personal";
    expect(parsePackFile(JSON.stringify(claimed)).origin).toBe("homebrew");
  });

  it("rejects files that are not packs", () => {
    expect(() => parsePackFile("nope")).toThrow(PackParseError);
    expect(() => parsePackFile(JSON.stringify({ hello: 1 }))).toThrow(PackParseError);
  });
});

describe("content with user packs", () => {
  it("adds the entries and their texts without touching the rest", async () => {
    const without = await loadContent(["en"]);
    const content = await loadContent(["en"], [record()]);
    expect(content.index.size).toBe(without.index.size + 1);
    expect(content.name("mine:spell/glow")).toBe("Glow");
    expect(content.text("mine:spell/glow", "desc")).toBe("A soft light.");
    expect(content.name("srd51:spell/fireball")).toBe("Fireball");
  });

  it("ignores a user pack that tries to reuse a built-in pack id", async () => {
    const clash = record();
    clash.pack = { ...clash.pack, manifest: { ...clash.pack.manifest, id: "srd51" }, entries: [] };
    const without = await loadContent(["en"]);
    const content = await loadContent(["en"], [clash]);
    expect(content.packs).toHaveLength(without.packs.length);
  });
});
