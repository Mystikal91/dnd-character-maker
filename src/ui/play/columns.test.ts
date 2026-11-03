import { describe, expect, it } from "vitest";
import { GROUPS, type LayoutFacts, estimateHeights, planColumns } from "./columns";

const facts = (over: Partial<LayoutFacts> = {}): LayoutFacts => ({
  attacks: 1,
  extraDamage: 0,
  actionCards: 2,
  actionGroups: 1,
  hitDiceKinds: 1,
  resources: 1,
  features: 10,
  companions: 0,
  tiles: 4,
  pack: 4,
  spells: 0,
  rage: false,
  wildShape: false,
  bardic: false,
  ...over,
});

const everything = () => true;
const noMagic = (panel: string) => panel !== "slots" && panel !== "spells";
const tall = (col: string[], h: Record<string, number>) => col.reduce((s, p) => s + (h[p] ?? 0), 0);

describe("the columns of the Play screen", () => {
  it("is one column of everything on a phone, in the order of the groups", () => {
    const [only] = planColumns(1, estimateHeights(facts()), everything);
    expect(only?.slice(0, 4)).toEqual(["hp", "death", "conditions", "rage"]);
    expect(only?.at(-1)).toBe("notes");
  });

  it("keeps every panel once and the panels in the order of the groups", () => {
    for (const columns of [2, 3] as const) {
      const plan = planColumns(columns, estimateHeights(facts({ spells: 6 })), everything);
      const all = plan.flat();
      expect(new Set(all).size).toBe(all.length);
      expect(all.length).toBe(GROUPS.flat().length + 1);
      // Read column after column, the panels follow the line of the groups (the notes go anywhere).
      expect(all.filter((p) => p !== "notes")).toEqual(GROUPS.flat());
    }
  });

  it("keeps a group in one column unless that makes a column much taller", () => {
    // A character with little to split: nothing is cut inside a group.
    const plan = planColumns(3, estimateHeights(facts({ features: 12 })), noMagic);
    for (const group of GROUPS) {
      const holders = plan.filter((col) => group.some((p) => col.includes(p)));
      expect(holders.length, group.join()).toBeLessThanOrEqual(1);
    }
  });

  it("leaves out what the character has not, and spells with it", () => {
    const plan = planColumns(3, estimateHeights(facts()), noMagic).flat();
    expect(plan).not.toContain("spells");
    expect(plan).not.toContain("slots");
    expect(plan).toContain("features");
  });

  it("comes out about even for a character with little, much or a lot of features", () => {
    for (const f of [
      facts(),
      facts({ features: 28, actionCards: 9, actionGroups: 3 }),
      facts({ features: 3, pack: 12 }),
    ]) {
      const h = estimateHeights(f);
      for (const columns of [2, 3] as const) {
        const plan = planColumns(columns, h, noMagic);
        const heights = plan.map((col) => tall(col, h));
        // No column is more than a panel's worth taller than the average.
        const average = heights.reduce((a, b) => a + b, 0) / columns;
        expect(Math.max(...heights)).toBeLessThan(average * 1.35);
      }
    }
  });

  it("changes with the character: a long features list has a column to itself", () => {
    const small = planColumns(3, estimateHeights(facts({ features: 3 })), noMagic);
    const big = planColumns(3, estimateHeights(facts({ features: 30 })), noMagic);
    expect(small).not.toEqual(big);
    // With thirty features the column of the features holds little else: what goes with them
    // (what is worn, the money, the notes) and nothing of the combat groups.
    const withFeatures = big.find((col) => col.includes("features")) ?? [];
    expect(withFeatures.filter((p) => ["hp", "attacks", "checks"].includes(p))).toEqual([]);
  });

  it("puts the notes at the end of the shortest column", () => {
    const h = estimateHeights(facts({ features: 30 }));
    const plan = planColumns(3, h, noMagic);
    const withoutNotes = plan.map((col) =>
      tall(
        col.filter((p) => p !== "notes"),
        h,
      ),
    );
    const holder = plan.findIndex((col) => col.includes("notes"));
    expect(withoutNotes[holder]).toBe(Math.min(...withoutNotes));
    expect(plan[holder]?.at(-1)).toBe("notes");
  });
});
