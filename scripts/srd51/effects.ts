/**
 * The numbers that features and traits change, written by hand: the source database has the
 * text of these features but not their effects. Keys are `<kind>/<slug>`.
 *
 * Add a line here (and regenerate with `npm run data:srd51`) to make a feature work on the
 * sheet. What cannot be expressed stays text.
 */
import type { Effect, ModifierCondition, ModifierTarget } from "../../src/data/schema";

const modifier = (target: ModifierTarget, value: number, when?: ModifierCondition): Effect => ({
  type: "modifier",
  target,
  value,
  ...(when && { when }),
});

const archery = [modifier("attack", 2, "ranged")];
const defense = [modifier("ac", 1, "wearingArmor")];
const dueling = [modifier("damage", 2, "dueling")];

export const FEATURE_EFFECTS: Record<string, Effect[]> = {
  // Armor class without armor.
  "feature/barbarian-unarmored-defense": [
    { type: "unarmoredDefense", base: 10, add: ["con"], shield: true },
  ],
  "feature/monk-unarmored-defense": [
    { type: "unarmoredDefense", base: 10, add: ["wis"], shield: false },
  ],
  "feature/draconic-resilience": [
    { type: "unarmoredDefense", base: 13, add: [], shield: true },
    modifier("hpPerLevel", 1),
  ],
  "trait/dwarven-toughness": [modifier("hpPerLevel", 1)],

  // Speed.
  "feature/fast-movement": [modifier("speed", 10, "noHeavyArmor")],

  // Fighting styles that change a number. Great Weapon Fighting, Two-Weapon Fighting and
  // Protection depend on dice rerolls, the off hand and reactions, so they stay text.
  "feature/fighter-fighting-style-archery": archery,
  "feature/ranger-fighting-style-archery": archery,
  "feature/fighter-fighting-style-defense": defense,
  "feature/fighting-style-defense": defense,
  "feature/ranger-fighting-style-defense": defense,
  "feature/fighter-fighting-style-dueling": dueling,
  "feature/fighting-style-dueling": dueling,
  "feature/ranger-fighting-style-dueling": dueling,
};

/**
 * Features whose child features are options to pick from (`parent` in the source): the number
 * is how many the character picks.
 */
export const OPTION_FEATURES: Record<string, number> = {
  "feature/fighter-fighting-style": 1,
  "feature/paladin-fighting-style": 1,
  "feature/ranger-fighting-style": 1,
};
