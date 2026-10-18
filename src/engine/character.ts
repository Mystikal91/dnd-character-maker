import { ABILITIES, type Ability } from "../data/schema";

export const CHARACTER_SCHEMA_VERSION = 1;

/** What gets saved. Everything on the sheet is derived from this by the engine. */
export interface Character {
  schemaVersion: typeof CHARACTER_SCHEMA_VERSION;
  ruleset: "srd51" | "srd52";
  name: string;
  choices: {
    species?: string;
    subspecies?: string;
    background?: string;
    classId?: string;
  };
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
    abilityBase: Object.fromEntries(ABILITIES.map((a) => [a, 10])) as Record<Ability, number>,
    overrides: {},
  };
}
