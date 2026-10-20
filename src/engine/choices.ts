import type { Ability, Effect, Entry, ProficiencyCategory } from "../data/schema";
import type { PackIndex } from "./derive";
import { type Warning, warn } from "./warnings";

type ChoiceEffect = Extract<Effect, { type: "choice" }>;

/** A choice offered by species, class, background or a trait, with the current picks applied. */
export interface PendingChoice {
  /** Key under which the picks are stored in `Character.selections`. */
  key: string;
  /** The entry that offers the choice. */
  source: string;
  id: string;
  grants: ChoiceGrant;
  choose: number;
  /** Ability bonus per pick, for `abilityBonus` choices. */
  value?: number;
  options: string[];
  /** Picks that are valid options, at most `choose` of them. */
  selected: string[];
  remaining: number;
}

export type ChoiceGrant = ChoiceEffect["grants"];

/** An effect with the entry it comes from, so the sheet can say where a number comes from. */
export interface SourcedEffect {
  effect: Effect;
  source: string;
}

export interface Collected {
  /** Every effect in force: direct ones, those of expanded traits and those of chosen options. */
  effects: Effect[];
  /** The same effects, each with the entry that gave it. */
  sourced: SourcedEffect[];
  choices: PendingChoice[];
}

interface Input {
  index: PackIndex;
  selections: Record<string, string[]>;
  warnings: Warning[];
}

/** The effect that picking `option` of a choice results in. */
function grantEffect(choice: ChoiceEffect, option: string): Effect {
  switch (choice.grants) {
    case "proficiency": {
      const [category, target] = option.split(":") as [ProficiencyCategory, string];
      return { type: "proficiency", category, target };
    }
    case "language":
      return { type: "proficiency", category: "language", target: option };
    case "abilityBonus":
      return { type: "abilityBonus", ability: option as Ability, value: choice.value ?? 1 };
    case "spell":
      return { type: "grantSpell", spell: option };
    case "trait":
      return { type: "trait", id: option };
  }
}

/**
 * Walks the effects of the given entries. Traits are followed into their own effects (each
 * once), and choices are resolved against the character's selections, so a picked option
 * contributes its effect exactly like a fixed one.
 */
export function collectEffects(
  entries: Entry[],
  { index, selections, warnings }: Input,
): Collected {
  const effects: Effect[] = [];
  const sourced: SourcedEffect[] = [];
  const choices: PendingChoice[] = [];
  const expanded = new Set<string>();

  const expandTrait = (id: string) => {
    if (expanded.has(id)) return;
    expanded.add(id);
    const trait = index.get(id);
    if (!trait) {
      warn(warnings, "unknownEntry", { id });
      return;
    }
    for (const effect of trait.effects) apply(effect, trait.id);
  };

  const resolve = (choice: ChoiceEffect, source: string) => {
    const key = `${source}/${choice.id}`;
    const selected: string[] = [];
    for (const option of selections[key] ?? []) {
      if (!choice.from.includes(option)) warn(warnings, "invalidChoice", { source, option });
      else if (selected.length >= choice.choose) warn(warnings, "tooManyChoices", { source });
      else if (!selected.includes(option)) selected.push(option);
    }
    choices.push({
      key,
      source,
      id: choice.id,
      grants: choice.grants,
      choose: choice.choose,
      ...(choice.value !== undefined && { value: choice.value }),
      options: choice.from,
      selected,
      remaining: choice.choose - selected.length,
    });
    for (const option of selected) apply(grantEffect(choice, option), source);
  };

  const apply = (effect: Effect, source: string) => {
    if (effect.type === "choice") return resolve(effect, source);
    effects.push(effect);
    sourced.push({ effect, source });
    if (effect.type === "trait") expandTrait(effect.id);
  };

  for (const entry of entries) for (const effect of entry.effects) apply(effect, entry.id);
  return { effects, sourced, choices };
}
