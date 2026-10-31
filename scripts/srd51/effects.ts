/**
 * The numbers that features and traits change, written by hand: the source database has the
 * text of these features but not their effects. Keys are `<kind>/<slug>`.
 *
 * Add a line here (and regenerate with `npm run data:srd51`) to make a feature work on the
 * sheet. What cannot be expressed stays text.
 */
import type { Effect, ModifierCondition, ModifierTarget } from "../../src/data/schema";

const resists = (damage: string): Effect => ({ type: "defense", kind: "resistance", damage });

const modifier = (
  target: ModifierTarget,
  value: number,
  when?: ModifierCondition,
  minLevel?: number,
): Effect => ({
  type: "modifier",
  target,
  value,
  ...(when && { when }),
  ...(minLevel !== undefined && { minLevel }),
});

const SKILLS = [
  "acrobatics",
  "animal-handling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleight-of-hand",
  "stealth",
  "survival",
];

/** Pick two skills to double the proficiency bonus of (a rogue may pick thieves' tools). */
const expertise = (id: string, extra: string[] = []): Effect => ({
  type: "choice",
  id,
  choose: 2,
  grants: "expertise",
  from: [...SKILLS, ...extra],
});

const spell = (slug: string): Effect => ({ type: "grantSpell", spell: `srd51:spell/${slug}` });
const skill = (target: string): Effect => ({ type: "proficiency", category: "skill", target });

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

  // Resistance to damage.
  "trait/dwarven-resilience": [resists("poison")],
  "trait/hellish-resistance": [resists("fire")],
  "trait/draconic-ancestry-black": [resists("acid")],
  "trait/draconic-ancestry-blue": [resists("lightning")],
  "trait/draconic-ancestry-brass": [resists("fire")],
  "trait/draconic-ancestry-bronze": [resists("lightning")],
  "trait/draconic-ancestry-copper": [resists("acid")],
  "trait/draconic-ancestry-gold": [resists("fire")],
  "trait/draconic-ancestry-green": [resists("poison")],
  "trait/draconic-ancestry-red": [resists("fire")],
  "trait/draconic-ancestry-silver": [resists("cold")],
  "trait/draconic-ancestry-white": [resists("cold")],

  // Speed.
  "feature/fast-movement": [modifier("speed", 10, "noHeavyArmor")],
  // +10 feet at level 2, and 5 more at levels 6, 10, 14 and 18, without armor or a shield.
  "feature/unarmored-movement-1": [
    modifier("speed", 10, "unarmoredNoShield", 2),
    modifier("speed", 5, "unarmoredNoShield", 6),
    modifier("speed", 5, "unarmoredNoShield", 10),
    modifier("speed", 5, "unarmoredNoShield", 14),
    modifier("speed", 5, "unarmoredNoShield", 18),
  ],

  // Immunities that hold all the time. Disease is not tracked, and what holds only against some
  // creatures (the charm and fear of Nature's Ward) or while raging stays text.
  "feature/purity-of-body": [
    { type: "defense", kind: "immunity", damage: "poison" },
    { type: "conditionImmunity", condition: "poisoned" },
  ],
  "feature/natures-ward": [
    { type: "defense", kind: "immunity", damage: "poison" },
    { type: "conditionImmunity", condition: "poisoned" },
  ],
  "feature/aura-of-courage": [{ type: "conditionImmunity", condition: "frightened" }],

  // Rolls.
  "feature/improved-critical": [{ type: "critRange", min: 19 }],
  "feature/superior-critical": [{ type: "critRange", min: 18 }],
  "feature/reliable-talent": [{ type: "d20Floor", value: 10, on: "proficientSkills" }],

  // Skills.
  "feature/jack-of-all-trades": [{ type: "halfProficiency", round: "down" }],
  "feature/remarkable-athlete": [
    { type: "halfProficiency", round: "up", abilities: ["str", "dex", "con"] },
  ],
  "feature/bard-expertise-1": [expertise("expertise")],
  "feature/bard-expertise-2": [expertise("expertise")],
  "feature/rogue-expertise-1": [expertise("expertise", ["thieves-tools"])],
  "feature/rogue-expertise-2": [expertise("expertise", ["thieves-tools"])],

  // Eldritch invocations and the pact of the chain that give a spell or a proficiency.
  "feature/eldritch-invocation-armor-of-shadows": [spell("mage-armor")],
  "feature/eldritch-invocation-beast-speech": [spell("speak-with-animals")],
  "feature/eldritch-invocation-eldritch-sight": [spell("detect-magic")],
  "feature/eldritch-invocation-fiendish-vigor": [spell("false-life")],
  "feature/eldritch-invocation-mask-of-many-faces": [spell("disguise-self")],
  "feature/eldritch-invocation-misty-visions": [spell("silent-image")],
  "feature/eldritch-invocation-whispers-of-the-grave": [spell("speak-with-dead")],
  "feature/eldritch-invocation-ascendant-step": [spell("levitate")],
  "feature/eldritch-invocation-otherworldly-leap": [spell("jump")],
  "feature/eldritch-invocation-master-of-myriad-forms": [spell("alter-self")],
  "feature/eldritch-invocation-visions-of-distant-realms": [spell("arcane-eye")],
  "feature/eldritch-invocation-chains-of-carceri": [spell("hold-monster")],
  "feature/eldritch-invocation-thief-of-five-fates": [spell("bane")],
  "feature/eldritch-invocation-sign-of-ill-omen": [spell("bestow-curse")],
  "feature/eldritch-invocation-bewitching-whispers": [spell("compulsion")],
  "feature/eldritch-invocation-dreadful-word": [spell("confusion")],
  "feature/eldritch-invocation-minions-of-chaos": [spell("conjure-elemental")],
  "feature/eldritch-invocation-sculptor-of-flesh": [spell("polymorph")],
  "feature/eldritch-invocation-mire-the-mind": [spell("slow")],
  "feature/eldritch-invocation-beguiling-influence": [skill("deception"), skill("persuasion")],
  "feature/pact-of-the-chain": [spell("find-familiar")],

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
 * What the source database leaves out of a subclass: a feature missing from its levels (the
 * Circle of the Land's terrain choice) and a domain spell (the Life domain's Guardian of Faith).
 */
export const SUBCLASS_FIXES: Record<
  string,
  {
    features?: { level: number; feature: string }[];
    spells?: { spell: string; classLevel: number }[];
  }
> = {
  land: { features: [{ level: 2, feature: "circle-of-the-land" }] },
  life: { spells: [{ spell: "guardian-of-faith", classLevel: 7 }] },
};

export interface OptionFeature {
  /** How many options the character picks. */
  choose: number;
  /** A key of the class table that sets the number instead (invocations, metamagic). */
  chooseBy?: string;
  /** Take the options of another feature (an extra fighting style picks among the same). */
  optionsOf?: string;
  /** Options the source does not link to the feature (Twinned Spell has no parent). */
  also?: string[];
}

/**
 * Features whose child features are options to pick from (`parent` in the source).
 */
export const OPTION_FEATURES: Record<string, OptionFeature> = {
  "feature/fighter-fighting-style": { choose: 1 },
  "feature/paladin-fighting-style": { choose: 1 },
  "feature/ranger-fighting-style": { choose: 1 },
  "feature/additional-fighting-style": { choose: 1, optionsOf: "feature/fighter-fighting-style" },
  "feature/eldritch-invocations": { choose: 1, chooseBy: "invocationsKnown" },
  "feature/pact-boon": { choose: 1 },
  "feature/metamagic-1": {
    choose: 2,
    chooseBy: "metamagicKnown",
    also: ["feature/metamagic-twinned-spell"],
  },
  "feature/hunters-prey": { choose: 1 },
  "feature/defensive-tactics": { choose: 1 },
  "feature/multiattack": { choose: 1 },
  "feature/superior-hunters-defense": { choose: 1 },
  "feature/circle-of-the-land": { choose: 1 },
};
