import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";
import { assumeBeast, leaveBeast } from "./wildShape";

/** A level 4 druid with Wisdom 16 (+3, proficient in Perception: +5), Strength 8 and Dexterity 12. */
function druid() {
  const c = createCharacter("srd51");
  c.classes = [{ classId: "srd51:class/druid", level: 4 }];
  c.abilityBase = { str: 8, dex: 12, con: 14, int: 10, wis: 16, cha: 10 };
  c.selections = {};
  return c;
}

const skill = (sheet: ReturnType<typeof deriveSheet>, slug: string) =>
  sheet.skills.find((s) => s.id.endsWith(`/${slug}`));

describe("a druid in the shape of a beast", () => {
  const own = deriveSheet(druid(), srd51Index);
  const wolf = (() => {
    const c = druid();
    c.play = assumeBeast(c.play, "srd51:monster/wolf", 11);
    return deriveSheet(c, srd51Index);
  })();

  it("has the physical scores, the armor class and the speed of the beast", () => {
    // The wolf: Strength 12, Dexterity 15, Constitution 12, armor class 13, speed 40.
    expect(wolf.abilities.str.score).toBe(12);
    expect(wolf.abilities.dex.score).toBe(15);
    expect(wolf.abilities.con.score).toBe(12);
    expect(wolf.armorClass.value).toBe(13);
    expect(wolf.speed).toBe(40);
    expect(own.abilities.str.score).toBe(8);
  });

  it("keeps their own mind and level", () => {
    expect(wolf.abilities.wis.score).toBe(own.abilities.wis.score);
    expect(wolf.abilities.int.score).toBe(own.abilities.int.score);
    expect(wolf.proficiencyBonus).toBe(own.proficiencyBonus);
    expect(wolf.level).toBe(4);
  });

  it("uses the scores of the beast for the checks that depend on them", () => {
    // Athletics goes with Strength: -1 for the druid, +1 as a wolf.
    expect(skill(wolf, "athletics")?.bonus).toBe(1);
    expect(skill(own, "athletics")?.bonus).toBe(-1);
    expect(wolf.initiative).toBe(own.initiative + 1); // Dexterity 15 (+2) against 12 (+1)
  });

  it("takes the skills and saves of the beast where they are better", () => {
    // The wolf is good at Stealth (+4): better than the druid's Dexterity (+1) alone.
    expect(skill(wolf, "stealth")?.bonus).toBe(4);
    expect(skill(own, "stealth")?.bonus).toBe(2 - 1); // Dexterity 12 (+1), no proficiency
    // Never worse: a skill the beast does not have keeps the druid's own bonus.
    expect(skill(wolf, "insight")?.bonus).toBe(skill(own, "insight")?.bonus);
    expect(wolf.passivePerception).toBe(10 + (skill(wolf, "perception")?.bonus ?? 0));
  });

  it("goes back to the sheet of the druid when the shape ends", () => {
    const back = druid();
    back.play = assumeBeast(back.play, "srd51:monster/wolf", 11);
    back.play = leaveBeast(back.play);
    expect(deriveSheet(back, srd51Index).abilities.str.score).toBe(8);
  });

  it("does nothing when the beast is not known", () => {
    const c = druid();
    c.play = assumeBeast(c.play, "imp1:monster/missing", 5);
    expect(deriveSheet(c, srd51Index).abilities.str.score).toBe(8);
  });
});
