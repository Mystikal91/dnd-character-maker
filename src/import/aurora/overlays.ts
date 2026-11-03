import type { Effect } from "../../data/schema";
import type { AuroraOptions, Context } from "./registry";
import { SRD_PAIRS } from "./registry";
import { mapRules } from "./rules";

/** What Aurora knows about an entry of the app that the entry does not: added to it, never replacing. */
export interface Overlay {
  effects?: Effect[];
  /** How the feature is used (`action`, `bonus`, `reaction`), when the entry does not say. */
  activation?: string;
}

const ACTIVATIONS: Record<string, string> = {
  action: "action",
  "bonus action": "bonus",
  reaction: "reaction",
};

/**
 * The numbers that are one value, whatever the level: a DC (8 + proficiency + a modifier), hit
 * points (5 + Constitution modifier). A name with a term that comes at a level is left out:
 * Aurora writes those as steps to add (a rage count of 2, then 1 more at the 3rd level), and the
 * sheet reads them as totals, so what it would show is wrong.
 */
function plainFeatureValues(effects: Effect[]): Effect[] {
  // A word (the damage type of an ancestry) is in the text and in the data of the SRD already.
  const stepped = new Set(
    effects.flatMap((e) =>
      e.type === "featureValue" &&
      (e.minLevel !== undefined || (typeof e.term === "object" && "text" in e.term))
        ? [e.name]
        : [],
    ),
  );
  return effects.filter((e) => e.type === "featureValue" && !stepped.has(e.name));
}

/**
 * What the elements of the Player's Handbook that are the entries of the app (see `srdPairs.json`)
 * say that the entries do not: the numbers a feature shows and how it is used. The entry of the
 * app keeps its text, its translations and what it already does; the pack carries these extras and
 * they are added when the content is put together, so removing the pack removes them.
 *
 * Only elements that pair with one entry are read: a feature the SRD splits by level (Brutal
 * Critical, Bardic Inspiration) pairs with several, and the same number would be shown on each.
 */
export function collectOverlays(ctx: Context, options: AuroraOptions): Record<string, Overlay> {
  const found: Record<string, Overlay> = {};
  for (const [aid, ids] of Object.entries(SRD_PAIRS)) {
    const id = ids.length === 1 ? ids[0] : undefined;
    const entry = id ? options.index.get(id) : undefined;
    const source = ctx.byAid.get(aid);
    // An element the pack makes for itself is not an entry of the app.
    if (!id || !entry || !source || ctx.needed.has(source)) continue;

    // Reading the rules counts what it cannot read: that is for the elements the pack makes.
    const real = ctx.result;
    ctx.result = { ...real, unsupportedRules: 0, unsupportedBy: {}, ruleKinds: {} };
    let mapped: Effect[];
    try {
      mapped = mapRules(ctx, source, { idPrefix: "overlay" }).effects;
    } finally {
      ctx.result = real;
    }

    const has = new Set(entry.effects.map((e) => JSON.stringify(e)));
    const names = new Set(
      entry.effects.flatMap((e) => (e.type === "featureValue" ? [e.name] : [])),
    );
    const effects = plainFeatureValues(mapped).filter(
      (e) => e.type === "featureValue" && !names.has(e.name) && !has.has(JSON.stringify(e)),
    );
    const action =
      ACTIVATIONS[
        (source.el.querySelector(":scope > sheet")?.getAttribute("action") ?? "")
          .trim()
          .toLowerCase()
      ];
    const activation = (entry.data as { activation?: string }).activation ? undefined : action;
    if (effects.length === 0 && !activation) continue;
    found[id] = { ...(effects.length > 0 && { effects }), ...(activation && { activation }) };
  }
  return found;
}
