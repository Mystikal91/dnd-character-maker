import { ABILITIES, type Ability } from "../data/schema";

export const CHARACTER_SCHEMA_VERSION = 1;

/** Levels taken in one class. The first entry of `Character.classes` is the starting class. */
export interface ClassLevel {
  classId: string;
  level: number;
  subclassId?: string;
  /** Hit die rolls for this class's levels, indexed by level - 1. Missing = average. */
  hpRolls?: number[];
}

/** An item the character owns. `itemId` can be an SRD item or a homebrew one. */
export interface InventoryItem {
  itemId: string;
  quantity: number;
  equipped: boolean;
}

/** What gets saved. Everything on the sheet is derived from this by the engine. */
export interface Character {
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
  /** Free edit: a forced value for a derived field, e.g. `ability.int`. Always wins. */
  overrides: Record<string, number | string | boolean>;
}

export function createCharacter(ruleset: Character["ruleset"]): Character {
  return {
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    ruleset,
    name: "",
    choices: {},
    classes: [],
    inventory: [],
    abilityBase: Object.fromEntries(ABILITIES.map((a) => [a, 10])) as Record<Ability, number>,
    overrides: {},
  };
}
