export type SuggestionField = "personalityTraits" | "ideals" | "bonds" | "flaws";

type TextOf = (id: string, field: string) => string | undefined;

/**
 * The ready-made personality traits, ideals, bonds or flaws a background offers, in order.
 * They are stored as numbered texts (`personalityTraits.1`, `.2`, ...) until one is missing.
 */
export function backgroundSuggestions(
  text: TextOf,
  backgroundId: string | undefined,
  field: SuggestionField,
): string[] {
  if (!backgroundId) return [];
  const found: string[] = [];
  for (let n = 1; ; n++) {
    const option = text(backgroundId, `${field}.${n}`);
    if (!option) return found;
    found.push(option);
  }
}

/** Adds a line to a free text, on its own line, unless it is already there. */
export function appendLine(current: string, line: string): string {
  const trimmed = current.trimEnd();
  if (trimmed.split("\n").includes(line)) return current;
  return trimmed ? `${trimmed}\n${line}` : line;
}
