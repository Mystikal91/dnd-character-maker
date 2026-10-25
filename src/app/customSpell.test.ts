// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { loadContent } from "../content/browser";
import { createCharacter } from "../engine/character";
import { blankDraft } from "../homebrew/model";
import { PERSONAL_SPELLS_PACK, addCustomSpell } from "./customSpell";
import { character, content } from "./store";
import { userPacks } from "./userPacks";

const spell = (values: Record<string, string>) => ({
  ...blankDraft("spell"),
  values: { name: "Whisper of Dust", level: "1", desc: "Dust speaks.", ...values },
});

describe("a spell written from a character", () => {
  beforeAll(async () => {
    content.value = await loadContent(["en"]);
    userPacks.value = [];
    character.value = createCharacter("srd51");
  });

  it("goes in a pack of its own and in the list of the class, a cantrip in the cantrips", async () => {
    const id = await addCustomSpell(spell({}), "srd51:class/wizard", "known");
    const cantrip = await addCustomSpell(
      spell({ name: "Dust Mote", level: "0" }),
      "srd51:class/wizard",
      "known",
    );
    const pack = userPacks.value.find((p) => p.id === PERSONAL_SPELLS_PACK);
    expect(pack?.origin).toBe("homebrew");
    expect(pack?.strings[`${id}.name`]).toBe("Whisper of Dust");
    const entry = pack?.pack.entries.find((e) => e.id === id);
    expect(entry?.data).toMatchObject({ level: 1, classes: ["srd51:class/wizard"] });
    const lists = character.value.spells["srd51:class/wizard"];
    expect(lists?.known).toEqual([id]);
    expect(lists?.cantrips).toEqual([cantrip]);
  });

  it("uses the list of prepared spells for a class that prepares", async () => {
    const id = await addCustomSpell(
      spell({ name: "Bright Verse" }),
      "srd51:class/cleric",
      "prepared",
    );
    expect(character.value.spells["srd51:class/cleric"]?.prepared).toEqual([id]);
    // The pack is the same one, with both spells in it.
    expect(userPacks.value.filter((p) => p.id === PERSONAL_SPELLS_PACK)).toHaveLength(1);
  });
});
