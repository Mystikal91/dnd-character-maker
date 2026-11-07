import type { Entry } from "../data/schema";

/** The ids an entry says it replaces (`data.replaces`): the earlier steps of an improving feature. */
export function replacesOf(entry: Entry | undefined): string[] {
  const raw = (entry?.data as { replaces?: unknown } | undefined)?.replaces;
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
}

/**
 * Which of the entries a character has are replaced by another it has, as `replaced id -> id that
 * replaces it`. A feature the SRD lists for each step ("Brutal Critical (1 die)", "(2 dice)") is
 * replaced as soon as the next step is reached, and so is the step before that one.
 */
export function supersededBy(
  ids: readonly string[],
  index: ReadonlyMap<string, Entry>,
): Record<string, string> {
  const have = new Set(ids);
  const out: Record<string, string> = {};
  for (const id of have)
    for (const replaced of replacesOf(index.get(id))) if (have.has(replaced)) out[replaced] = id;
  return out;
}
