import type { Ability, FeatureTerm } from "../data/schema";
import type { SourcedEffect } from "./choices";

/** A number a feature shows, worked out for the character: `breath weapon:dc` is 14. */
export interface FeatureValue {
  name: string;
  value: string;
}

export interface FeatureValueState {
  /** The level that counts for what an entry gives: its class's, or the whole character's. */
  levelOf: (source: string) => number;
  level: number;
  proficiencyBonus: number;
  ability: (ability: Ability) => { score: number; modifier: number };
  /** The level in the class with this slug (0 when the character has none of it). */
  classLevel: (slug: string) => number;
}

function termValue(term: FeatureTerm, state: FeatureValueState): number | string {
  if (typeof term === "number") return term;
  if ("text" in term) return term.text;
  if ("of" in term) return term.of === "level" ? state.level : state.proficiencyBonus;
  if ("mod" in term) return state.ability(term.mod).modifier;
  if ("score" in term) return state.ability(term.score).score;
  return state.classLevel(term.classLevel);
}

/**
 * The numbers the features of the character show, by the entry that gives them. The terms of a
 * name add up; those that come at a level replace one another (the latest one reached counts).
 */
export function deriveFeatureValues(
  sourced: SourcedEffect[],
  state: FeatureValueState,
): Record<string, FeatureValue[]> {
  const sums = new Map<
    string,
    Map<string, { sum: number; step?: { level: number; value: number }; text?: string }>
  >();
  for (const { effect, source } of sourced) {
    if (effect.type !== "featureValue") continue;
    const level = effect.minLevel;
    if (level !== undefined && state.levelOf(source) < level) continue;
    const names = sums.get(source) ?? new Map();
    sums.set(source, names);
    const acc = names.get(effect.name) ?? { sum: 0 };
    names.set(effect.name, acc);
    const value = termValue(effect.term, state);
    if (typeof value === "string") acc.text ??= value;
    else if (level === undefined) acc.sum += value;
    else if (!acc.step || level >= acc.step.level) acc.step = { level, value };
  }
  const found: Record<string, FeatureValue[]> = {};
  for (const [source, names] of sums)
    found[source] = [...names].map(([name, acc]) => ({
      name,
      value: acc.text ?? String(acc.sum + (acc.step?.value ?? 0)),
    }));
  return found;
}
