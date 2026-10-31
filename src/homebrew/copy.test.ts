import { describe, expect, it } from "vitest";
import { parsePack } from "../data/schema";
import { loadSrd51Strings, srd51Index } from "../test/srd51";
import { type TextSource, copyDraft } from "./copy";
import { newHomebrewPack, saveDraft } from "./model";

/** The texts of the SRD, by the kind of entry they belong to; keys are the slug and the field. */
const FILES: Record<string, string[]> = {
  spell: ["spells"],
  class: ["classes"],
  species: ["species"],
  trait: ["traits", "subspecies"],
  feature: ["features"],
};
const strings = Object.fromEntries(
  Object.entries(FILES).map(([kind, files]) => [
    kind,
    Object.assign({}, ...files.map((f) => loadSrd51Strings(f))) as Record<string, string>,
  ]),
);
const parts = (id: string) => {
  const [kind = "", slug = ""] = id.split(":")[1]?.split("/") ?? [];
  return { texts: strings[kind] ?? {}, slug };
};

const source: TextSource = {
  index: srd51Index,
  fields: (id) => {
    const { texts, slug } = parts(id);
    return Object.keys(texts)
      .filter((k) => k.startsWith(`${slug}.`))
      .map((k) => k.slice(slug.length + 1));
  },
  read: (id, field) => {
    const { texts, slug } = parts(id);
    return texts[`${slug}.${field}`] ?? "";
  },
};
const copyName = (name: string) => `${name} (copy)`;
const entry = (id: string) => {
  const found = srd51Index.get(id);
  if (!found) throw new Error(id);
  return found;
};
const context = { languages: ["common"], skills: ["athletics", "acrobatics", "arcana"] };

describe("copying a rules entry as homebrew", () => {
  it("copies a spell with its texts and marks the name as a copy", () => {
    const draft = copyDraft(entry("srd51:spell/fireball"), source, copyName);
    expect(draft?.kind).toBe("spell");
    expect(draft?.values.name).toBe("Fireball (copy)");
    expect(draft?.values.level).toBe("3");
    expect(draft?.values.desc).toContain("bright streak");
  });

  it("brings the features of a class along", () => {
    const draft = copyDraft(entry("srd51:class/fighter"), source, copyName);
    expect(draft?.kind).toBe("class");
    expect(draft?.traits.length).toBeGreaterThan(5);
    expect(draft?.traits.every((t) => t.name && t.text)).toBe(true);
  });

  it("brings the traits of a species along", () => {
    const draft = copyDraft(entry("srd51:species/dwarf"), source, copyName);
    expect(draft?.kind).toBe("species");
    expect(draft?.traits.length).toBeGreaterThan(0);
  });

  it("saves as an entry of its own that the pack schema accepts, leaving the original alone", () => {
    const draft = copyDraft(entry("srd51:spell/fireball"), source, copyName);
    if (!draft) throw new Error("no draft");
    const { record, id } = saveDraft(newHomebrewPack("Mine", 1000), draft, context);
    expect(() => parsePack(record.pack)).not.toThrow();
    expect(id).not.toBe("srd51:spell/fireball");
    expect(record.strings[`${id}.name`]).toBe("Fireball (copy)");
    expect(srd51Index.has("srd51:spell/fireball")).toBe(true);
  });

  it("gives nothing for an entry the editor cannot open", () => {
    const skill = [...srd51Index.values()].find((e) => e.kind === "condition");
    expect(skill && copyDraft(skill, source, copyName)).toBeUndefined();
  });
});
