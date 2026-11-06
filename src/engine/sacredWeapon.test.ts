import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";
import { explain } from "./explain";
import { advanceRound, endSacredWeapon, setSacredWeapon, shortRest } from "./play";
import { canSpend, spendPool } from "./spends";

const sword = "srd51:item/longsword";

function paladin(level: number, cha: number, on = false) {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/human";
  c.classes = [{ classId: "srd51:class/paladin", level, subclassId: "srd51:subclass/devotion" }];
  c.abilityBase = { str: 16, dex: 10, con: 12, int: 10, wis: 10, cha };
  c.inventory = [{ itemId: sword, quantity: 1, equipped: true }];
  if (on) c.play = setSacredWeapon(c.play, sword);
  return { character: c, sheet: deriveSheet(c, srd51Index) };
}
const attack = (s: ReturnType<typeof paladin>["sheet"]) =>
  s.attacks.find((a) => a.itemId === sword);

describe("Channel Divinity: Sacred Weapon", () => {
  it("is offered to a paladin of Devotion from the 3rd level, and changes nothing until it is on", () => {
    expect(attack(paladin(2, 16).sheet)?.canSacredWeapon).toBeUndefined();
    const a = attack(paladin(3, 16).sheet);
    expect(a?.canSacredWeapon).toBe(true);
    expect(a?.sacredWeapon).toBeUndefined();
  });

  it("adds the Charisma modifier to the attack roll and makes the weapon magical", () => {
    const off = attack(paladin(3, 16).sheet);
    const on = attack(paladin(3, 16, true).sheet);
    expect(on?.attackBonus).toBe((off?.attackBonus ?? 0) + 3);
    expect(on).toMatchObject({ sacredWeapon: 3, magical: true });
    expect(off?.magical).toBe(false);
  });

  it("adds at least +1, even with a low Charisma", () => {
    const off = attack(paladin(3, 8).sheet);
    const on = attack(paladin(3, 8, true).sheet);
    expect(on?.attackBonus).toBe((off?.attackBonus ?? 0) + 1);
  });

  it("does not change the damage", () => {
    expect(attack(paladin(3, 16, true).sheet)?.damage).toEqual(
      attack(paladin(3, 16).sheet)?.damage,
    );
  });

  it("lasts ten rounds, and a short rest ends it too", () => {
    const { character } = paladin(3, 16, true);
    expect(character.play.sacredWeapon).toBe(sword);
    expect(character.play.rounds?.sacredWeapon).toBe(10);
    let play = character.play;
    for (let i = 0; i < 9; i++) play = advanceRound(play).play;
    expect(play.sacredWeapon).toBe(sword);
    const last = advanceRound(play);
    expect(last.ended).toContain("sacredWeapon");
    expect(last.play.sacredWeapon).toBeUndefined();
    expect(shortRest(character.play, "none").sacredWeapon).toBeUndefined();
    expect(endSacredWeapon(character.play).rounds?.sacredWeapon).toBeUndefined();
  });

  it("takes a Channel Divinity use, and one only is there at the 3rd level", () => {
    const { character, sheet } = paladin(3, 16);
    const spend = Object.entries(sheet.spends).find(([id]) =>
      id.endsWith("/channel-divinity-sacred-weapon"),
    )?.[1];
    expect(spend).toBeDefined();
    if (!spend) return;
    expect(canSpend(character.play, spend, sheet.resources)).toBe(true);
    const spent = spendPool(character.play, spend, sheet.resources);
    expect(canSpend(spent, spend, sheet.resources)).toBe(false);
  });
});

describe("the attack bonus of a weapon with Sacred Weapon, taken apart", () => {
  it("names the feature and still adds up", () => {
    const { character, sheet } = paladin(3, 16, true);
    const result = explain({ kind: "attack", itemId: sword }, sheet, character, srd51Index);
    expect(result?.lines.reduce((sum, l) => sum + l.value, 0)).toBe(result?.total);
    expect(result?.lines).toContainEqual({
      part: "feature",
      value: 3,
      ref: "srd51:feature/channel-divinity-sacred-weapon",
    });
  });
});
