// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { loadContent } from "../content/browser";
import { AURORA_IMPORT_VERSION } from "../import/aurora";
import { content } from "./store";
import { importAuroraFiles, isStale, userPacks } from "./userPacks";

const XML = `<?xml version="1.0" encoding="utf-8" ?><elements><info><name>Test Set</name></info>
  <element name="Glimmer" type="Spell" source="Test Book" id="ID_TEST_SPELL_GLIMMER">
    <supports>Wizard</supports>
    <description><p>A small light appears.</p></description>
    <setters>
      <set name="level">1</set>
      <set name="school">Evocation</set>
      <set name="time">1 action</set>
      <set name="range">30 feet</set>
      <set name="duration">1 minute</set>
    </setters>
  </element></elements>`;
const file = () => new File([XML], "glimmer.xml", { type: "text/xml" });

describe("importing a pack again", () => {
  beforeAll(async () => {
    content.value = await loadContent(["en"]);
  });

  it("remembers its files and the importer version, and keeps its id when made again", async () => {
    await importAuroraFiles([file()]);
    const [first] = userPacks.value;
    expect(userPacks.value).toHaveLength(1);
    expect(first?.source).toEqual({ files: ["glimmer.xml"] });
    expect(first?.importVersion).toBe(AURORA_IMPORT_VERSION);
    expect(first && isStale(first)).toBe(false);

    // A pack made by an older importer, or before the version was kept, needs updating.
    if (!first) throw new Error("no pack");
    userPacks.value = [{ ...first, importVersion: undefined, addedAt: 123 }];
    expect(isStale(userPacks.value[0] as typeof first)).toBe(true);

    await importAuroraFiles([file()], first.id);
    expect(userPacks.value).toHaveLength(1);
    const again = userPacks.value[0];
    expect(again?.id).toBe(first.id);
    // Its own entries were not mistaken for ones the app already has.
    expect(again?.pack.entries.length).toBe(first.pack.entries.length);
    expect(again?.pack.entries.length).toBeGreaterThan(0);
    expect(again?.addedAt).toBe(123);
    expect(again && isStale(again)).toBe(false);
  });
});
