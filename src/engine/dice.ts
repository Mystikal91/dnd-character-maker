/** A source of whole numbers in [0, max): injected so tests can use fixed sequences. */
export type RandomInt = (max: number) => number;

/** An unbiased random integer in [0, max) from the browser's cryptographic generator. */
export const cryptoRandomInt: RandomInt = (max) => {
  const limit = Math.floor(0x100000000 / max) * max; // reject the biased tail
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while ((buffer[0] ?? 0) >= limit);
  return (buffer[0] ?? 0) % max;
};

export interface DiceTerm {
  count: number;
  sides: number;
}

export interface DiceExpression {
  terms: DiceTerm[];
  modifier: number;
}

export interface DiceRoll {
  /** The expression as written, normalised (`2d6+3`). */
  expression: string;
  /** The faces rolled, term by term. */
  rolls: number[][];
  modifier: number;
  total: number;
}

const MAX_DICE = 100;
const MAX_SIDES = 1000;

/**
 * Parses sums of dice and flat numbers: `d20`, `2d6+3`, `1d8 + 1d4 - 1`. Returns undefined for
 * anything else, so user input can be checked without throwing.
 */
export function parseDice(text: string): DiceExpression | undefined {
  const source = text.replace(/\s+/g, "").toLowerCase();
  if (!source || !/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(source)) return undefined;

  const terms: DiceTerm[] = [];
  let modifier = 0;
  for (const part of source.match(/[+-]?[^+-]+/g) ?? []) {
    const sign = part.startsWith("-") ? -1 : 1;
    const body = part.replace(/^[+-]/, "");
    const dice = /^(\d*)d(\d+)$/.exec(body);
    if (dice) {
      const count = dice[1] === "" ? 1 : Number(dice[1]);
      const sides = Number(dice[2]);
      if (sign < 0) return undefined; // subtracting dice is not a thing in the rules
      if (count < 1 || count > MAX_DICE || sides < 2 || sides > MAX_SIDES) return undefined;
      terms.push({ count, sides });
    } else {
      modifier += sign * Number(body);
    }
  }
  return terms.length > 0 ? { terms, modifier } : undefined;
}

export function formatDice({ terms, modifier }: DiceExpression): string {
  const dice = terms.map((t) => `${t.count}d${t.sides}`).join("+");
  return modifier === 0 ? dice : `${dice}${modifier > 0 ? "+" : "-"}${Math.abs(modifier)}`;
}

export function rollExpression(
  expression: DiceExpression,
  random: RandomInt = cryptoRandomInt,
): DiceRoll {
  const rolls = expression.terms.map((term) =>
    Array.from({ length: term.count }, () => 1 + random(term.sides)),
  );
  const total = rolls.flat().reduce((sum, face) => sum + face, 0) + expression.modifier;
  return { expression: formatDice(expression), rolls, modifier: expression.modifier, total };
}

export type D20Mode = "normal" | "advantage" | "disadvantage";

export interface D20Roll {
  /** Both dice for advantage and disadvantage, one otherwise. */
  dice: number[];
  /** The die that counts. */
  used: number;
  bonus: number;
  total: number;
  critical: boolean;
  fumble: boolean;
  mode: D20Mode;
}

/** A d20 check with a flat bonus, rolling twice and keeping one for advantage or disadvantage. */
export function rollD20(
  bonus: number,
  mode: D20Mode = "normal",
  random: RandomInt = cryptoRandomInt,
): D20Roll {
  const first = 1 + random(20);
  const dice = mode === "normal" ? [first] : [first, 1 + random(20)];
  const used =
    mode === "advantage" ? Math.max(...dice) : mode === "disadvantage" ? Math.min(...dice) : first;
  return {
    dice,
    used,
    bonus,
    total: used + bonus,
    critical: used === 20,
    fumble: used === 1,
    mode,
  };
}
