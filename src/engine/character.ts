import { ABILITIES, type Ability } from "../data/schema";

export const CHARACTER_SCHEMA_VERSION = 6;

/** How ability scores were generated. Only `manual` has no constraints on the numbers. */
export type AbilityMethod = "manual" | "standard" | "pointbuy" | "roll";

/** Levels taken in one class. The first entry of `Character.classes` is the starting class. */
export interface ClassLevel {
  classId: string;
  level: number;
  subclassId?: string;
  /** Hit die rolls for this class's levels, indexed by level - 1. Missing = average. */
  hpRolls?: number[];
}

/**
 * Spells a character picked for one class. Which lists apply depends on the class: known
 * casters fill `cantrips` and `known`; prepared casters fill `cantrips` and `prepared`;
 * wizards fill `cantrips`, `known` (the spellbook) and `prepared`.
 */
export interface ClassSpells {
  cantrips: string[];
  known: string[];
  prepared: string[];
}

/** Who the character is, in the player's own words. All free text; empty means not written yet. */
export interface Story {
  /** Alignment entry id, e.g. `srd51:alignment/chaotic-good`. */
  alignment?: string;
  /** Deity entry id, from a pack that has deities (the SRD has none). */
  deity?: string;
  personalityTraits: string;
  ideals: string;
  bonds: string;
  flaws: string;
  appearance: string;
  backstory: string;
  allies: string;
  enemies: string;
  /** Anything else worth keeping with the sheet (extra features, reminders). */
  notes: string;
  age: string;
  height: string;
  weight: string;
  eyes: string;
  skin: string;
  hair: string;
}

export const STORY_TEXT_FIELDS = [
  "personalityTraits",
  "ideals",
  "bonds",
  "flaws",
  "appearance",
  "backstory",
  "allies",
  "enemies",
  "notes",
  "age",
  "height",
  "weight",
  "eyes",
  "skin",
  "hair",
] as const;

export function createStory(): Story {
  return Object.fromEntries(STORY_TEXT_FIELDS.map((f) => [f, ""])) as unknown as Story;
}

/** What changes during play: hit points, spent resources, conditions. */
export interface PlayState {
  /** Current hit points. Undefined means "at full health", so levelling up needs no fix-up. */
  hp?: number;
  tempHp: number;
  /** Hit dice spent since the last long rest, by die (`d8`). */
  hitDiceUsed: Record<string, number>;
  /** Spell slots spent per spell level 1..9. */
  slotsUsed: number[];
  /** Uses spent of limited class features, by resource id (see `ClassResource`). */
  resourcesUsed?: Record<string, number>;
  /** The spell the character is concentrating on, if any. */
  concentration?: string;
  /** Pact Magic slots spent, when they are kept apart from the shared slots (multiclass warlock). */
  pactUsed?: number;
  deathSaves: { successes: number; failures: number };
  /** Ids of the conditions currently affecting the character. */
  conditions: string[];
  inspiration: boolean;
}

export function createPlayState(): PlayState {
  return {
    tempHp: 0,
    hitDiceUsed: {},
    slotsUsed: Array.from({ length: 9 }, () => 0),
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    inspiration: false,
  };
}

/** An item the character owns. `itemId` can be an SRD item or a homebrew one. */
export interface InventoryItem {
  itemId: string;
  quantity: number;
  equipped: boolean;
  /** An item of the player's own, with no entry in any pack: `itemId` is only a key. Weight is in pounds. */
  custom?: { name: string; weight?: number; note?: string };
  /** A weapon that is magic (made so by a spell such as Magic Weapon, or by a ritual). */
  magical?: boolean;
  /** A bonus to attack and damage rolls that a spell or an enchantment gives (0 to 3). */
  bonus?: number;
  /** The cantrip Shillelagh is on this club or quarterstaff: it is magic and uses the spellcasting ability. */
  shillelagh?: boolean;
  /** A magic item (an entry with `enchants`) that the weapon carries: its bonus and effects apply. */
  enchantment?: string;
}

/** What gets saved. Everything on the sheet is derived from this by the engine. */
export interface Character {
  /** Stable identity of this character across saves, exports and imports. */
  id: string;
  schemaVersion: typeof CHARACTER_SCHEMA_VERSION;
  ruleset: "srd51" | "srd52";
  name: string;
  choices: {
    species?: string;
    subspecies?: string;
    background?: string;
  };
  classes: ClassLevel[];
  inventory: InventoryItem[];
  abilityBase: Record<Ability, number>;
  abilityMethod: AbilityMethod;
  /** The six rolled values, when `abilityMethod` is `roll`. */
  abilityRolls?: number[];
  /**
   * Picks for the choices that species, class, background and traits offer, keyed by
   * `<entry id>/<choice id>`. Each value is the list of selected options.
   */
  selections: Record<string, string[]>;
  /** Spell picks, keyed by class id. */
  spells: Record<string, ClassSpells>;
  play: PlayState;
  story: Story;
  /**
   * Ability Score Improvements taken, one entry per improvement: one ability is +2,
   * two different abilities are +1 each.
   */
  asi: Ability[][];
  /** Feats taken. Each one uses up an ability score improvement. */
  feats: string[];
  /** Free edit: a forced value for a derived field, e.g. `ability.int`. Always wins. */
  overrides: Record<string, number | string | boolean>;
}

export function createCharacter(ruleset: Character["ruleset"]): Character {
  return {
    id: crypto.randomUUID(),
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    ruleset,
    name: "",
    choices: {},
    classes: [],
    inventory: [],
    abilityBase: Object.fromEntries(ABILITIES.map((a) => [a, 10])) as Record<Ability, number>,
    abilityMethod: "manual",
    selections: {},
    spells: {},
    play: createPlayState(),
    story: createStory(),
    asi: [],
    feats: [],
    overrides: {},
  };
}
