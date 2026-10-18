import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { createCharacter } from "../engine/character";
import {
  deleteCharacter,
  getCurrentId,
  listCharacters,
  loadCharacter,
  saveCharacter,
  setCurrentId,
} from "./characters";
import { dbPut } from "./db";
import { exportFileName, parseImport, serializeCharacter } from "./transfer";

function named(name: string) {
  const c = createCharacter("srd51");
  c.name = name;
  return c;
}

describe("character storage", () => {
  it("saves and loads a character", async () => {
    const c = named("Aria");
    c.classes = [{ classId: "srd51:class/rogue", level: 2 }];
    await saveCharacter(c);
    expect(await loadCharacter(c.id)).toEqual(c);
    await deleteCharacter(c.id);
  });

  it("overwrites on save, lists newest first, and deletes", async () => {
    const a = named("Old");
    const b = named("New");
    await saveCharacter(a, 1000);
    await saveCharacter(b, 2000);
    a.name = "Old, renamed";
    await saveCharacter(a, 3000);

    const names = (await listCharacters())
      .filter((s) => [a.id, b.id].includes(s.id))
      .map((s) => s.name);
    expect(names).toEqual(["Old, renamed", "New"]);

    await deleteCharacter(a.id);
    await deleteCharacter(b.id);
    expect(await loadCharacter(a.id)).toBeUndefined();
  });

  it("returns undefined for a missing or corrupt record instead of throwing", async () => {
    expect(await loadCharacter("does-not-exist")).toBeUndefined();
    await dbPut("characters", { id: "broken", updatedAt: 1, character: { nonsense: true } });
    expect(await loadCharacter("broken")).toBeUndefined();
    await deleteCharacter("broken");
  });

  it("remembers the current character", async () => {
    await setCurrentId("abc");
    expect(await getCurrentId()).toBe("abc");
  });
});

describe("export and import", () => {
  it("round-trips a character but gives the import a new id", () => {
    const c = named("Thorin");
    c.choices.species = "srd51:species/dwarf";
    const imported = parseImport(serializeCharacter(c));
    expect({ ...imported, id: c.id }).toEqual(c);
    expect(imported.id).not.toBe(c.id);
  });

  it("accepts a bare character document", () => {
    const c = named("Bare");
    expect(parseImport(JSON.stringify(c)).name).toBe("Bare");
  });

  it("rejects invalid files", () => {
    expect(() => parseImport("not json")).toThrow();
    expect(() =>
      parseImport(JSON.stringify({ format: "dnd-character-maker", character: {} })),
    ).toThrow();
  });

  it("builds a safe file name", () => {
    expect(exportFileName(named("Elowen of the Vale!"))).toBe("elowen-of-the-vale.dndchar.json");
    expect(exportFileName(named(""))).toBe("character.dndchar.json");
  });
});
