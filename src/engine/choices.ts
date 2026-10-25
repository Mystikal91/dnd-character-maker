import type { Ability, Effect, Entry, ProficiencyCategory } from "../data/schema";
import type { PackIndex } from "./derive";
import { evaluateRequirements } from "./requirements";
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

/** The options of a choice: what it lists, or every feat when a feat choice lists none. */
function optionsOf(index: PackIndex, choice: ChoiceEffect): string[] {
  if (choice.grants !== "feat" || choice.from.length > 0) return choice.from;
  return [...index.values()].filter((e) => e.kind === "feat").map((e) => e.id);
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
    case "feat":
      return { type: "trait", id: option };
    case "expertise":
      return { type: "expertise", skill: option };
  }
}

/**
 * Walks the effects of the given entries. Traits are followed into their own effects (each
 * once), and choices are resolved against the character's selections, so a picked option
 * contributes its effect exactly like a fixed one.
 */
export function collectEffects(entries: Entry[], input: Input, alsoHeld: string[] = []): Collected {
  // Effects behind a requirement (`when`) depend on what is held, and what is held depends on
  // the effects that apply (a trait, a flag). Walk again with what the last walk found until it
  // stops changing; a walk that met no requirement is final at once.
  let held = new Set([...entries.map((e) => e.id), ...alsoHeld]);
  for (let pass = 1; ; pass++) {
    const warnings: Warning[] = [];
    const walk = walkEffects(entries, { ...input, warnings }, held);
    const next = new Set([...alsoHeld, ...walk.seen]);
    const settled =
      !walk.gated ||
      pass >= 4 ||
      (next.size === held.size && [...next].every((id) => held.has(id)));
    if (settled) {
      input.warnings.push(...warnings);
      return walk;
    }
    held = next;
  }
}

function walkEffects(
  entries: Entry[],
  { index, selections, warnings }: Input,
  held: ReadonlySet<string>,
): Collected & { seen: Set<string>; gated: boolean } {
  const effects: Effect[] = [];
  const sourced: SourcedEffect[] = [];
  const choices: PendingChoice[] = [];
  const expanded = new Set<string>();
  const seen = new Set<string>(entries.map((e) => e.id));
  let gated = false;

  const expandTrait = (id: string) => {
    if (expanded.has(id)) return;
    expanded.add(id);
    seen.add(id);
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
    const options = optionsOf(index, choice);
    for (const option of selections[key] ?? []) {
      if (!options.includes(option)) warn(warnings, "invalidChoice", { source, option });
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
      options,
      selected,
      remaining: choice.choose - selected.length,
    });
    for (const option of selected) apply(grantEffect(choice, option), source);
  };

  const apply = (effect: Effect, source: string) => {
    if (effect.type === "choice") return resolve(effect, source);
    if (effect.type === "flag") {
      seen.add(effect.id);
      return;
    }
    if (effect.type === "when") {
      gated = true;
      if (evaluateRequirements(effect.requires, (word) => held.has(word)))
        for (const inner of effect.effects) apply(inner, source);
      return;
    }
    effects.push(effect);
    sourced.push({ effect, source });
    if (effect.type === "trait") expandTrait(effect.id);
  };

  for (const entry of entries) for (const effect of entry.effects) apply(effect, entry.id);
  return { effects, sourced, choices, seen, gated };
}
