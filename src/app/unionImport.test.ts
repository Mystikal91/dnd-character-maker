// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadContent } from "../content/browser";
import type { UserPackRecord } from "../storage/packs";
import { content } from "./store";
import {
  importAuroraUrl,
  packError,
  reimportPack,
  reimportStalePacks,
  userPacks,
} from "./userPacks";

const BASE = "https://raw.githubusercontent.com/AuroraLegacy/elements/master/";
const spell = (name: string, id: string) => `
  <element name="${name}" type="Spell" source="Test Book" id="${id}">
    <supports>Wizard</supports>
    <description><p>${name} appears.</p></description>
    <setters><set name="level">1</set><set name="school">Evocation</set><set name="time">1 action</set>
      <set name="range">30 feet</set><set name="duration">1 minute</set></setters>
  </element>`;
const elements = (title: string, ...body: string[]) =>
  `<?xml version="1.0" encoding="utf-8" ?><elements><info><name>${title}</name></info>${body.join("")}</elements>`;
const index = (title: string, ...files: string[]) =>
  `<?xml version="1.0" encoding="utf-8" ?><index><info><name>${title}</name></info><files>${files
    .map((f) => `<file url="${BASE}${f}" />`)
    .join("")}</files></index>`;

const FILES: Record<string, string> = {
  "core.index": index("Core", "core/a.xml"),
  "core/a.xml": elements(
    "Core",
    spell("Core Light", "ID_T_SPELL_CORE_LIGHT"),
    `<element name="Core Gift" type="Feat Feature" source="Test Book" id="ID_T_FEATURE_CORE">
      <description><p>A gift.</p></description></element>`,
  ),
  "supplements.index": index("Supplements", "supplements/b.xml"),
  "supplements/b.xml": elements("Supplements", spell("Extra Light", "ID_T_SPELL_EXTRA_LIGHT")),
  "unearthed-arcana.index": index("Unearthed Arcana", "ua/c.xml"),
  "ua/c.xml": elements(
    "Unearthed Arcana",
    spell("Odd Light", "ID_T_SPELL_ODD_LIGHT"),
    `<element name="Odd Gift" type="Feat" source="Test Book" id="ID_T_FEAT_ODD">
      <description><p>Odd.</p></description>
      <rules><grant type="Feat Feature" id="ID_T_FEATURE_CORE" /></rules></element>`,
  ),
};

const asked: string[] = [];
beforeAll(async () => {
  content.value = await loadContent(["en"]);
  vi.stubGlobal("fetch", async (url: string) => {
    asked.push(url);
    const text = FILES[url.replace(BASE, "")];
    return text === undefined
      ? new Response("", { status: 404 })
      : new Response(text, { status: 200 });
  });
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  userPacks.value = [];
  packError.value = undefined;
  asked.length = 0;
});

const spells = (record: UserPackRecord | undefined) =>
  (record?.pack.entries ?? []).filter((e) => e.kind === "spell").length;

describe("the indexes of Aurora Legacy imported one after the other", () => {
  it("takes an index without the ones it depends on, and says what is incomplete until they come", async () => {
    await importAuroraUrl(`${BASE}unearthed-arcana.index`);
    expect(packError.value).toBeUndefined();
    const [alone] = userPacks.value;
    expect(userPacks.value).toHaveLength(1);
    // The feat gives a feature that the core defines: without the core it cannot work.
    const feat = alone?.pack.entries.find((e) => e.kind === "feat");
    expect(Object.keys(alone?.unresolved ?? {})).toEqual([feat?.id]);
    expect(alone?.unresolved?.[feat?.id ?? ""]).toEqual(["ID_T_FEATURE_CORE"]);

    // With the core read together with it, nothing is left unresolved.
    await importAuroraUrl(`${BASE}core.index`);
    expect(userPacks.value).toHaveLength(1);
    expect(Object.keys(userPacks.value[0]?.unresolved ?? {})).toEqual([]);
  });

  it("reads a new index together with the ones before it, as one pack that keeps its id", async () => {
    await importAuroraUrl(`${BASE}core.index`);
    expect(packError.value).toBeUndefined();
    const [core] = userPacks.value;
    expect(userPacks.value).toHaveLength(1);
    expect(core?.source?.urls).toEqual([`${BASE}core.index`]);
    expect(spells(core)).toBe(1);

    await importAuroraUrl(`${BASE}supplements.index`);
    expect(userPacks.value).toHaveLength(1);
    const joined = userPacks.value[0];
    expect(joined?.id).toBe(core?.id);
    expect(joined?.name).toBe("Aurora Legacy");
    expect(joined?.source?.urls).toEqual([`${BASE}core.index`, `${BASE}supplements.index`]);
    expect(spells(joined)).toBe(2);

    // Importing it again reads all of its addresses.
    asked.length = 0;
    if (joined) await reimportPack(joined);
    expect(asked.filter((u) => u.endsWith(".index")).sort()).toEqual([
      `${BASE}core.index`,
      `${BASE}supplements.index`,
    ]);
    expect(userPacks.value).toHaveLength(1);
  });

  it("keeps the indexes in the order the collection lists them, whatever order they were added in", async () => {
    await importAuroraUrl(`${BASE}unearthed-arcana.index`);
    await importAuroraUrl(`${BASE}supplements.index`);
    await importAuroraUrl(`${BASE}core.index`);
    expect(userPacks.value).toHaveLength(1);
    expect(userPacks.value[0]?.source?.urls).toEqual([
      `${BASE}core.index`,
      `${BASE}supplements.index`,
      `${BASE}unearthed-arcana.index`,
    ]);
  });

  it("folds the packs made one for each index into one", async () => {
    await importAuroraUrl(`${BASE}core.index`);
    const core = userPacks.value[0] as UserPackRecord;
    // Packs as older versions made them: the second one apart from the first.
    const apart: UserPackRecord = {
      ...core,
      id: "impother",
      name: "Supplements (Aurora)",
      source: { url: `${BASE}supplements.index` },
      pack: { ...core.pack, manifest: { ...core.pack.manifest, id: "impother" }, entries: [] },
      strings: {},
    };
    userPacks.value = [core, apart];

    await importAuroraUrl(`${BASE}unearthed-arcana.index`);
    expect(userPacks.value).toHaveLength(1);
    const one = userPacks.value[0];
    expect(one?.id).toBe(core.id);
    expect(one?.source?.urls).toEqual([
      `${BASE}core.index`,
      `${BASE}supplements.index`,
      `${BASE}unearthed-arcana.index`,
    ]);
    expect(spells(one)).toBe(3);
  });

  it("folds packs made apart into one when one of them is imported again, or all that are outdated", async () => {
    await importAuroraUrl(`${BASE}core.index`);
    const core = userPacks.value[0] as UserPackRecord;
    const apart = (): UserPackRecord => ({
      ...core,
      id: "impother",
      name: "Supplements (Aurora)",
      source: { url: `${BASE}supplements.index` },
      pack: { ...core.pack, manifest: { ...core.pack.manifest, id: "impother" }, entries: [] },
      strings: {},
    });
    // Made by an older importer, as separate packs, each with its own address.
    const old = { ...core, source: { url: `${BASE}core.index` }, importVersion: 1 };

    userPacks.value = [old, { ...apart(), importVersion: 1 }];
    await reimportPack(old);
    expect(userPacks.value).toHaveLength(1);
    expect(userPacks.value[0]?.id).toBe(core.id);
    expect(userPacks.value[0]?.source?.urls).toEqual([
      `${BASE}core.index`,
      `${BASE}supplements.index`,
    ]);
    expect(spells(userPacks.value[0])).toBe(2);

    // The same when the person updates them all at once: the one folded in is not brought back.
    userPacks.value = [old, { ...apart(), importVersion: 1 }];
    await reimportStalePacks();
    expect(userPacks.value).toHaveLength(1);
    expect(spells(userPacks.value[0])).toBe(2);
  });

  it("leaves an address that is not one of the indexes of Aurora Legacy as a pack of its own", async () => {
    await importAuroraUrl(`${BASE}core.index`);
    FILES["mine.index"] = index("Mine", "core/a.xml");
    await importAuroraUrl(`${BASE}mine.index`);
    expect(packError.value).toBeUndefined();
    expect(userPacks.value.length).toBe(2);
  });
});
