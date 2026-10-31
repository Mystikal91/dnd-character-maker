import { ABILITIES } from "../data/schema";
import type { Owner } from "../engine/scaling";
import { character, sheet } from "./store";

/** The numbers of the open character that a creature of theirs grows with, once the sheet exists. */
export function currentOwner(): Owner | undefined {
  const s = sheet.value;
  if (!s) return undefined;
  const classes = character.value.classes;
  const highest = classes.reduce((best, c) => Math.max(best, c.level), 0);
  return {
    pb: s.proficiencyBonus,
    spellAttack: s.spellcasters[0]?.attackBonus ?? s.proficiencyBonus,
    mods: Object.fromEntries(ABILITIES.map((a) => [a, s.abilities[a].modifier])),
    levelIn: (className) =>
      (className && classes.find((c) => c.classId.endsWith(`/${className}`))?.level) || highest,
  };
}
