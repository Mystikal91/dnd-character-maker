import { ABILITIES, type Ability } from "../data/schema";

export const CHARACTER_SCHEMA_VERSION = 3;

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

/** An item the character owns. `itemId` can be an SRD item or a homebrew one. */
export interface InventoryItem {
  itemId: string;
  quantity: number;
  equipped: boolean;
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
  /**
   * Ability Score Improvements taken, one entry per improvement: one ability is +2,
   * two different abilities are +1 each.
   */
  asi: Ability[][];
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
    asi: [],
    overrides: {},
  };
}
