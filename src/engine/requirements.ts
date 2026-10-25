import type { Effect } from "../data/schema";

/**
 * Evaluates a requirement written the way Aurora writes them: commas mean "and", `||` (or `|`)
 * means "or", brackets group, and `!` negates a word or a whole group, so `!(A||B)` holds when
 * neither is held. A word is held when `isHeld` says so.
 */
export function evaluateRequirements(
  requirements: string,
  isHeld: (word: string) => boolean,
): boolean {
  const text = requirements.trim();
  if (!text) return true;
  let at = 0;
  const skip = () => {
    while (text[at] === " ") at++;
  };
  const term = (): boolean => {
    skip();
    if (text[at] === "!") {
      at++;
      return !term();
    }
    if (text[at] === "(") {
      at++;
      const inside = or();
      skip();
      if (text[at] === ")") at++;
      return inside;
    }
    // A condition on a number of the sheet, `[str:13]`, is one word up to its closing bracket.
    const word = /^(?:\[[^\]]*\]|[^,()|!]+)/.exec(text.slice(at));
    if (!word) {
      at++; // a stray character: skip it rather than loop
      return true;
    }
    at += word[0].length;
    return isHeld(word[0].trim());
  };
  const and = (): boolean => {
    let value = term();
    skip();
    while (text[at] === ",") {
      at++;
      const next = term();
      value = value && next;
      skip();
    }
    return value;
  };
  const or = (): boolean => {
    let value = and();
    skip();
    while (text[at] === "|") {
      at += text.startsWith("||", at) ? 2 : 1;
      const next = and();
      value = value || next;
      skip();
    }
    return value;
  };
  return or();
}

/**
 * The effects as they stand when nothing is held yet: gated ones count when their requirement
 * holds with nothing. For showing what an entry gives before any choice is made.
 */
export function plainEffects(effects: Effect[], held: ReadonlySet<string> = new Set()): Effect[] {
  return effects.flatMap((e) =>
    e.type !== "when"
      ? [e]
      : evaluateRequirements(e.requires, (word) => held.has(word))
        ? plainEffects(e.effects, held)
        : [],
  );
}

/** The flags an entry sets by itself, with its own id: what it holds before anything else is known. */
export function heldBy(id: string, effects: Effect[]): Set<string> {
  const held = new Set([id]);
  const visit = (list: Effect[]) => {
    for (const e of list) {
      if (e.type === "flag") held.add(e.id);
      else if (e.type === "when") visit(e.effects);
    }
  };
  visit(effects);
  return held;
}

/** The words of a requirement, without the operators: what it asks to be held or not. */
export function requirementWords(requirements: string): string[] {
  const words: string[] = [];
  evaluateRequirements(requirements, (word) => {
    words.push(word);
    return false;
  });
  return words;
}
