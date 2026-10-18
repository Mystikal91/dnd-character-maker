import { describe, expect, it } from "vitest";
import { createCharacter } from "../engine/character";
import { CharacterParseError } from "../engine/characterSchema";
import { QR_MAX_BYTES, decodeShare, encodeShare, isShareHash, shareUrl } from "./share";

function sample() {
  const c = createCharacter("srd51");
  c.name = "Aria Windrunner";
  c.classes = [{ classId: "srd51:class/rogue", level: 3 }];
  c.story.backstory = "Raised by the harbor guild, she learned to read locks before letters.";
  return c;
}

describe("share links", () => {
  it("round-trips a character with a new id", async () => {
    const original = sample();
    const hash = await encodeShare(original);
    expect(isShareHash(hash)).toBe(true);
    const copy = await decodeShare(hash);
    expect(copy.id).not.toBe(original.id);
    expect({ ...copy, id: "" }).toEqual({ ...original, id: "" });
  });

  it("uses only characters that are safe in a URL fragment", async () => {
    expect(await encodeShare(sample())).toMatch(/^#c=1\.[A-Za-z0-9_-]+$/);
  });

  it("keeps a typical character small enough for a QR code", async () => {
    const url = await shareUrl(sample(), "https://example.github.io/dnd-character-maker/");
    expect(url.length).toBeLessThan(QR_MAX_BYTES);
  });

  it("replaces an old fragment instead of stacking another one", async () => {
    const url = await shareUrl(sample(), "https://example.org/app/#c=1.old");
    expect(url.match(/#/g)).toHaveLength(1);
  });

  it("rejects links that are not valid", async () => {
    for (const bad of ["#c=", "#c=2.abc", "#c=1.", "#c=1.not-compressed", "#other"]) {
      await expect(decodeShare(bad)).rejects.toBeInstanceOf(CharacterParseError);
    }
  });
});
