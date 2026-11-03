// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { UserPackRecord } from "../storage/packs";
import { loadContent } from "./browser";

const id = "srd51:feature/font-of-magic";

const record = (origin: UserPackRecord["origin"]): UserPackRecord => ({
  id: "imp-test",
  name: "Test",
  origin,
  addedAt: 1,
  pack: {
    manifest: {
      id: "imptest",
      ruleset: "srd51",
      version: "1",
      license: "personal use",
      attribution: "Test",
    },
    entries: [],
  },
  strings: {},
  lang: "en",
  overlays: { [id]: { activation: "bonus" } },
});

describe("the content with a pack that adds to the SRD", () => {
  it("puts what the pack adds on the entry, keeping its texts", async () => {
    const plain = await loadContent(["en"], []);
    const added = await loadContent(["en"], [record("personal")]);
    expect((plain.index.get(id)?.data as { activation?: string }).activation).toBeUndefined();
    expect((added.index.get(id)?.data as { activation?: string }).activation).toBe("bonus");
    expect(added.name(id)).toBe(plain.name(id));
    expect(added.text(id, "desc")).toBe(plain.text(id, "desc"));
  });

  it("only lets the packs read from other tools do it", async () => {
    const edits = await loadContent(["en"], [record("homebrew")]);
    expect((edits.index.get(id)?.data as { activation?: string }).activation).toBeUndefined();
  });
});
