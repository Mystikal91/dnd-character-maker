import type { Entry } from "../data/schema";
import type { Character } from "./character";
import type { DerivedSheet } from "./derive";

/**
 * In the shape of a beast the game statistics are the beast's, but the druid keeps their mind
 * (Intelligence, Wisdom, Charisma), their proficiencies and their level. This is the character as
 * the sheet counts them then: the physical scores, the armor class and the walking speed of the
 * beast take the place of their own.
 */
export function inBeastShape(character: Character, beast: Entry): Character {
  const overrides = { ...character.overrides };
  const scores = beast.data.abilities as Record<string, number> | undefined;
  for (const ability of ["str", "dex", "con"]) {
    const score = scores?.[ability];
    if (typeof score === "number") overrides[`ability.${ability}`] = score;
  }
  const armor = (beast.data.armorClass as { value?: number }[] | undefined)?.[0]?.value;
  if (typeof armor === "number") overrides.ac = armor;
  const walk = (beast.data.speed as Record<string, unknown> | undefined)?.walk;
  if (typeof walk === "number") overrides.speed = walk;
  return { ...character, overrides };
}

/**
 * The skills and saving throws the beast is good at count when their bonus is higher than the
 * druid's own (who keeps their proficiencies and gains those of the beast).
 */
export function withBeastChecks(sheet: DerivedSheet, beast: Entry): DerivedSheet {
  const skills = (beast.data.skills ?? {}) as Record<string, number>;
  const saves = (beast.data.saves ?? {}) as Record<string, number>;
  const nextSkills = sheet.skills.map((skill) => {
    const own = skills[skill.id.split("/")[1] ?? ""];
    return own !== undefined && own > skill.bonus
      ? { ...skill, bonus: own, proficient: true }
      : skill;
  });
  const nextSaves = { ...sheet.saves };
  for (const [ability, bonus] of Object.entries(saves)) {
    const key = ability as keyof typeof nextSaves;
    if (nextSaves[key] && bonus > nextSaves[key].bonus)
      nextSaves[key] = { bonus, proficient: true };
  }
  const perception = nextSkills.find((s) => s.id.endsWith("/perception"));
  return {
    ...sheet,
    skills: nextSkills,
    saves: nextSaves,
    ...(perception && { passivePerception: 10 + perception.bonus }),
  };
}
