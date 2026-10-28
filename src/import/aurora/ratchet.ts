import type { Effect, Entry } from "../../data/schema";

/** How well one Aurora element was turned into an entry: the effects it ended with, the rules left out. */
export type Outcome = [effects: number, unsupported: number];
export type Outcomes = Record<string, Outcome>;

/** The effects of an entry, the ones inside a `when` counted and the `when` itself not. */
export function countEffects(effects: readonly Effect[]): number {
  return effects.reduce((sum, e) => sum + (e.type === "when" ? countEffects(e.effects) : 1), 0);
}

/**
 * An outcome for every element of Aurora that became an entry. `aids` says which entry each
 * element became; `unsupportedBy` counts the rules of an element that the app cannot apply.
 */
export function measure(
  entries: readonly Entry[],
  aids: Record<string, string>,
  unsupportedBy: Record<string, number>,
): Outcomes {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const outcomes: Outcomes = {};
  for (const aid of Object.keys(aids).sort()) {
    const entry = byId.get(aids[aid] ?? "");
    outcomes[aid] = [entry ? countEffects(entry.effects) : 0, unsupportedBy[aid] ?? 0];
  }
  return outcomes;
}

/**
 * What got worse since the baseline: an element that is gone, one that ends with fewer effects,
 * one with more rules left out. Better, and new elements, are not problems.
 */
export function worse(baseline: Outcomes, current: Outcomes): string[] {
  const problems: string[] = [];
  for (const [aid, [effects, unsupported]] of Object.entries(baseline)) {
    const now = current[aid];
    if (!now) problems.push(`${aid}: no longer imported`);
    else {
      if (now[0] < effects) problems.push(`${aid}: ${effects} effects before, ${now[0]} now`);
      if (now[1] > unsupported)
        problems.push(`${aid}: ${unsupported} rules left out before, ${now[1]} now`);
    }
  }
  return problems;
}

/** The baseline as a file: one element to a line, so a change reads well in a diff. */
export function toFile(outcomes: Outcomes): string {
  const lines = Object.entries(outcomes).map(
    ([aid, o]) => `  ${JSON.stringify(aid)}: [${o[0]}, ${o[1]}]`,
  );
  return `{\n${lines.join(",\n")}\n}\n`;
}
