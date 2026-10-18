import {
  ABILITIES,
  type Ability,
  type Effect,
  type Entry,
  PROFICIENCY_CATEGORIES,
  type Pack,
  type ProficiencyCategory,
} from "../data/schema";
import { abilityModifier } from "./abilities";
import type { Character } from "./character";

export type PackIndex = Map<string, Entry>;

export function indexPacks(...packs: Pack[]): PackIndex {
  const index: PackIndex = new Map();
  for (const pack of packs) for (const entry of pack.entries) index.set(entry.id, entry);
  return index;
}

export interface AbilityResult {
  base: number;
  bonus: number;
  score: number;
  modifier: number;
  overridden: boolean;
}

export interface DerivedSheet {
  abilities: Record<Ability, AbilityResult>;
  proficiencies: Record<ProficiencyCategory, string[]>;
  traits: string[];
  /** Problems found while deriving. Never blocking: the sheet is still produced. */
  warnings: string[];
}

function selectedEntries(character: Character, index: PackIndex, warnings: string[]): Entry[] {
  const ids = Object.values(character.choices).filter((id): id is string => Boolean(id));
  const entries: Entry[] = [];
  for (const id of ids) {
    const entry = index.get(id);
    if (entry) entries.push(entry);
    else warnings.push(`Unknown entry: ${id}`);
  }
  return entries;
}

export function deriveSheet(character: Character, index: PackIndex): DerivedSheet {
  const warnings: string[] = [];
  const effects: Effect[] = selectedEntries(character, index, warnings).flatMap((e) => e.effects);

  const abilities = {} as Record<Ability, AbilityResult>;
  for (const ability of ABILITIES) {
    const base = character.abilityBase[ability];
    const bonus = effects.reduce(
      (sum, e) => (e.type === "abilityBonus" && e.ability === ability ? sum + e.value : sum),
      0,
    );
    const override = character.overrides[`ability.${ability}`];
    const overridden = typeof override === "number";
    const score = overridden ? override : base + bonus;
    if (!overridden && score > 20) warnings.push(`${ability} is above 20 (${score})`);
    abilities[ability] = { base, bonus, score, modifier: abilityModifier(score), overridden };
  }

  const proficiencies = Object.fromEntries(
    PROFICIENCY_CATEGORIES.map((c) => [c, [] as string[]]),
  ) as Record<ProficiencyCategory, string[]>;
  const traits: string[] = [];
  for (const effect of effects) {
    if (effect.type === "proficiency") {
      const list = proficiencies[effect.category];
      if (!list.includes(effect.target)) list.push(effect.target);
    } else if (effect.type === "trait" && !traits.includes(effect.id)) {
      traits.push(effect.id);
    }
  }

  return { abilities, proficiencies, traits, warnings };
}
