import type { Entry } from "../data/schema";
import { evaluateRequirements, requirementWords } from "./requirements";

/** `[level:9]`: the word that asks for a level of the class. */
const LEVEL_WORD = /^\[level:(\d+)\]$/;

/** What the character has when an option is checked: the level of the class and everything held. */
export interface NeedState {
  level: number;
  /** Ids of the features, traits, spells, class and subclass the character has, and the flags set. */
  held: ReadonlySet<string>;
}

/** What one option of a choice asks for, and whether the character has it. */
export interface OptionNeed {
  /** The requirement as an expression: `[level:9],srd51:feature/pact-of-the-blade`. */
  expression: string;
  met: boolean;
}

/**
 * What an option (an eldritch invocation, a metamagic option) asks of the character, as one
 * expression. The SRD writes it as a list in `data.prerequisites` (`level`, `feature`, `spell`),
 * Aurora in the `requirements` of the element, which the importer keeps as `data.requires`. Empty
 * when it asks for nothing. The ability score minimums of a feat are not here: they are read by
 * `featPrerequisite`.
 */
export function needsOf(entry: Entry | undefined): string {
  const data = entry?.data as { requires?: unknown; prerequisites?: unknown } | undefined;
  if (!data) return "";
  const parts: string[] = [];
  if (typeof data.requires === "string" && data.requires.trim())
    parts.push(`(${data.requires.trim()})`);
  if (Array.isArray(data.prerequisites)) {
    for (const need of data.prerequisites as {
      type?: string;
      level?: unknown;
      feature?: unknown;
      spell?: unknown;
    }[]) {
      if (need.type === "level" && typeof need.level === "number")
        parts.push(`[level:${need.level}]`);
      else if (need.type === "feature" && typeof need.feature === "string")
        parts.push(need.feature);
      else if (need.type === "spell" && typeof need.spell === "string") parts.push(need.spell);
    }
  }
  return parts.join(",");
}

/** Whether the character holds what the expression asks for. */
export function needsMet(expression: string, state: NeedState): boolean {
  return evaluateRequirements(expression, (word) => {
    const level = LEVEL_WORD.exec(word);
    if (level) return state.level >= Number(level[1]);
    // A condition on a score or anything else written in brackets is not one of these.
    if (word.startsWith("[")) return true;
    return state.held.has(word);
  });
}

/**
 * The words of the expression that can be shown: levels and entries the app knows. Words that are
 * not an entry the app has (the 2024 twin of a feature, which is not imported) are left out, since
 * the person could never hold them.
 */
export function needWords(
  expression: string,
  knows: (id: string) => boolean,
): ({ level: number } | { id: string })[] {
  const seen = new Set<string>();
  const out: ({ level: number } | { id: string })[] = [];
  for (const word of requirementWords(expression)) {
    if (seen.has(word)) continue;
    seen.add(word);
    const level = LEVEL_WORD.exec(word);
    if (level) out.push({ level: Number(level[1]) });
    else if (!word.startsWith("[") && knows(word)) out.push({ id: word });
  }
  return out;
}

/**
 * Whether the character has what an option asks for, and what is missing that can be told. An
 * expression that fails only on words the app does not know (a flag of the book, the 2024 twin of
 * a feature) counts as met: the person could never fix it, so it must not shut an option.
 */
export function checkNeeds(
  expression: string,
  state: NeedState,
  knows: (id: string) => boolean,
): { met: boolean; missing: ({ level: number } | { id: string })[] } {
  if (needsMet(expression, state)) return { met: true, missing: [] };
  const missing = needWords(expression, knows).filter((w) =>
    "level" in w ? state.level < w.level : !state.held.has(w.id),
  );
  return { met: missing.length === 0, missing };
}
