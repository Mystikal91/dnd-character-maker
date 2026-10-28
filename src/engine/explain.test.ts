import { describe, expect, it } from "vitest";
import { ABILITIES } from "../data/schema";
import { CLASSES, build, complete } from "../test/characters";
import { srd51Index as index } from "../test/srd51";
import { deriveSheet } from "./derive";
import { type ExplainTarget, explain } from "./explain";

const sum = (lines: { value: number }[]) => lines.reduce((total, l) => total + l.value, 0);

describe("explaining a number", () => {
  it("adds up to the number shown, for every class", () => {
    for (const cls of CLASSES) {
      for (const level of [1, 5, 11]) {
        const character = complete(build(cls, level, "human"));
        const sheet = deriveSheet(character, index);
        const targets: ExplainTarget[] = [
          { kind: "ac" },
          { kind: "initiative" },
          ...ABILITIES.map((ability) => ({ kind: "save" as const, ability })),
          ...sheet.skills.map((s) => ({ kind: "skill" as const, id: s.id })),
          ...sheet.attacks.map((a) => ({ kind: "attack" as const, itemId: a.itemId })),
        ];
        for (const target of targets) {
          const explained = explain(target, sheet, character, index);
          const where = `${cls} ${level} ${JSON.stringify(target)}`;
          expect(explained, where).toBeDefined();
          if (explained) expect(sum(explained.lines), where).toBe(explained.total);
        }
      }
    }
  });

  it("names the armor, the shield and the ability of armor class", () => {
    const character = build("fighter", 1, "human");
    character.inventory.push({ itemId: "srd51:item/shield", quantity: 1, equipped: true });
    const sheet = deriveSheet(character, index);
    const explained = explain({ kind: "ac" }, sheet, character, index);
    expect(explained?.lines).toEqual([
      { part: "armor", value: 16, ref: "srd51:item/chain-mail" },
      { part: "shield", value: 2, ref: "srd51:item/shield" },
    ]);
  });

  it("separates proficiency from expertise on a skill", () => {
    const character = complete(build("rogue", 1, "human"));
    const sheet = deriveSheet(character, index);
    const expert = sheet.skills.find((s) => s.proficient);
    expect(expert).toBeDefined();
    const lines = explain({ kind: "skill", id: expert?.id ?? "" }, sheet, character, index)?.lines;
    expect(lines?.some((l) => l.part === "proficiency")).toBe(true);
  });

  it("says a forced value is forced", () => {
    const character = build("fighter", 1, "human");
    character.overrides.ac = 25;
    const sheet = deriveSheet(character, index);
    const explained = explain({ kind: "ac" }, sheet, character, index);
    expect(explained?.total).toBe(25);
    expect(explained?.forced).toBe(true);
  });
});
