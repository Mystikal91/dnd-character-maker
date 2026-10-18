import { describe, expect, it } from "vitest";
import { parsePack } from "./schema";

const manifest = {
  id: "test",
  ruleset: "custom",
  version: "0.0.0",
  license: "CC-BY-4.0",
  attribution: "Test data",
};

describe("parsePack", () => {
  it("accepts a valid pack and defaults effects to an empty list", () => {
    const pack = parsePack({
      manifest,
      entries: [{ id: "test:elf", kind: "species" }],
    });
    expect(pack.entries[0]?.effects).toEqual([]);
  });

  it("rejects ids that do not start with the pack id", () => {
    expect(() =>
      parsePack({ manifest, entries: [{ id: "other:elf", kind: "species" }] }),
    ).toThrow();
  });

  it("rejects duplicate ids", () => {
    expect(() =>
      parsePack({
        manifest,
        entries: [
          { id: "test:elf", kind: "species" },
          { id: "test:elf", kind: "species" },
        ],
      }),
    ).toThrow();
  });

  it("rejects malformed ids and unknown effect types", () => {
    expect(() => parsePack({ manifest, entries: [{ id: "Elf", kind: "species" }] })).toThrow();
    expect(() =>
      parsePack({
        manifest,
        entries: [{ id: "test:elf", kind: "species", effects: [{ type: "explode" }] }],
      }),
    ).toThrow();
  });
});
