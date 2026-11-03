/**
 * How the panels of the Play screen are spread over two or three columns on a wide screen. They
 * keep a meaning: the panels that belong together are one group and stay in one column, the
 * groups follow one another as a player reaches for them (how am I, what do I do, what do I roll,
 * what do I have, who am I), and the columns are cut from that line where they come out of about
 * the same height. The heights are estimated from what the character has: a rogue with two
 * features and a monk with twenty-five do not need the same plan.
 */

/** The groups, in the order they are read. A panel that is missing for the character leaves its group. */
export const GROUPS: readonly (readonly string[])[] = [
  // How am I: hit points, dying, conditions, rage and shapes.
  ["hp", "death", "conditions", "rage"],
  // What do I do: attacks and the things done with an action.
  ["attacks", "actions"],
  // Spells and the slots they take.
  ["slots", "spells"],
  ["companions"],
  // Inspiration: the state of the character, spent on a d20 roll, so it sits before the rolls.
  ["inspiration"],
  // What do I roll.
  ["checks", "dice", "history"],
  // What I have to use and get back.
  ["classres", "hitdice", "rests"],
  // Who I am.
  ["features"],
  // What I wear and carry, and what it is worth.
  ["inventory", "coins"],
];

/** Panels that sit anywhere: they go at the end of the shortest column. */
export const FILLERS: readonly string[] = ["notes"];

/** What a character has, as far as the height of the panels goes. */
export interface LayoutFacts {
  attacks: number;
  extraDamage: number;
  /** The cards of the Actions panel. */
  actionCards: number;
  /** How many of the three kinds of action have cards. */
  actionGroups: number;
  hitDiceKinds: number;
  resources: number;
  features: number;
  companions: number;
  /** Places of the equipment board that are shown, and things in the backpack. */
  tiles: number;
  pack: number;
  spells: number;
  rage: boolean;
  wildShape: boolean;
  bardic: boolean;
}

/**
 * About how tall each panel is, in pixels, at the width of a column. Worked out from the panels as
 * they are drawn; they do not have to be exact, only near enough that the columns come out even.
 */
export function estimateHeights(f: LayoutFacts): Record<string, number> {
  return {
    hp: 320,
    death: 0,
    conditions: 560,
    rage: (f.rage ? 130 : 0) + (f.wildShape ? 200 : 0),
    attacks: 150 + 150 * f.attacks + 100 * f.extraDamage,
    actions: 310 + 105 * f.actionCards + 55 * f.actionGroups,
    slots: 540,
    spells: 160 + 175 * f.spells,
    companions: 195 + 150 * f.companions,
    inspiration: 340 + (f.bardic ? 150 : 0),
    checks: 830,
    dice: 235,
    history: 115,
    classres: 150 + 90 * f.resources,
    hitdice: 100 + 115 * f.hitDiceKinds,
    rests: 480,
    features: 120 + 90 * f.features,
    inventory: 170 + 100 * Math.ceil(f.tiles / 2) + 85 * f.pack,
    coins: 365,
    notes: 210,
  };
}

/**
 * What it costs, in pixels of the tallest column, to cut a group in two: two panels that belong
 * together are worth keeping in one column unless that makes a column much taller than the others.
 */
const SPLIT_COST = 250;

/**
 * Splits the panels, in the order of the groups, into `columns` runs where the tallest column is
 * as short as it can be, counting a cut inside a group as `SPLIT_COST` more; then the columns are
 * as even as can be. The fillers go at the end of the shortest column. Returns the panels of each.
 */
export function planColumns(
  columns: 1 | 2 | 3,
  heights: Record<string, number>,
  present: (panel: string) => boolean,
): string[][] {
  const groups = GROUPS.map((g) => g.filter(present)).filter((g) => g.length > 0);
  const fillers = FILLERS.filter(present);
  const line = groups.flat();
  if (columns === 1) return [[...line, ...fillers]];

  const high = (panel: string) => heights[panel] ?? 0;
  const prefix = [0];
  for (const panel of line) prefix.push((prefix[prefix.length - 1] ?? 0) + high(panel));
  const span = (from: number, to: number) => (prefix[to] ?? 0) - (prefix[from] ?? 0);
  // A cut before panel `i` is inside a group when the panel before it is of the same group.
  const groupOf = line.map((_, i) => groups.findIndex((g) => g.includes(line[i] as string)));
  const splits = (cut: number) =>
    cut > 0 && cut < line.length && groupOf[cut - 1] === groupOf[cut] ? 1 : 0;

  const n = line.length;
  const options: number[][] = [];
  if (columns === 2) for (let a = 0; a <= n; a++) options.push([a]);
  else for (let a = 0; a <= n; a++) for (let b = a; b <= n; b++) options.push([a, b]);

  let chosen: number[] = [];
  let lowest = Number.POSITIVE_INFINITY;
  let evenest = Number.POSITIVE_INFINITY;
  for (const cuts of options) {
    const edges = [0, ...cuts, n];
    const tallness = edges.slice(0, -1).map((from, i) => span(from, edges[i + 1] ?? n));
    const cost = Math.max(...tallness) + SPLIT_COST * cuts.reduce((sum, c) => sum + splits(c), 0);
    const squares = tallness.reduce((sum, h) => sum + h * h, 0);
    if (cost < lowest || (cost === lowest && squares < evenest)) {
      chosen = cuts;
      lowest = cost;
      evenest = squares;
    }
  }
  const edges = [0, ...chosen, n];
  const plan = edges.slice(0, -1).map((from, i) => line.slice(from, edges[i + 1]));

  for (const filler of fillers) {
    let shortest = 0;
    let least = Number.POSITIVE_INFINITY;
    plan.forEach((col, i) => {
      const h = col.reduce((sum, panel) => sum + high(panel), 0);
      if (h < least) {
        least = h;
        shortest = i;
      }
    });
    plan[shortest]?.push(filler);
  }
  return plan;
}
