import { type Context, FEATURE_TYPES } from "./registry";
import { readRules, spellIdOf } from "./rules";
import { UNDEFINED_IDS } from "./undefinedIds";

const TOKEN = /\bID_[A-Za-z0-9_]+\b/g;

/**
 * The ids a requirement asks to be held. One that is negated (`!ID_X`, `!(ID_X||ID_Y)`) says "unless
 * this is there": the element it names replaces this one when it exists (the feats of Tasha's that
 * stand in for their Unearthed Arcana versions), so its absence is no loss.
 */
function wanted(requirements: string): string[] {
  const positive = requirements.replace(/!\s*\([^()]*\)/g, "").replace(/!\s*ID_[A-Za-z0-9_]+/g, "");
  return positive.match(TOKEN) ?? [];
}

/** Rule types whose id names an element of the books, not a built-in thing like a size or a skill. */
const ELEMENT_TYPES = new Set([
  ...FEATURE_TYPES,
  "Feat",
  "Option",
  "Archetype",
  "Sub Race",
  "Race",
  "Race Variant",
  "Class",
  "Background",
  "Grants",
  "Ability Score Improvement",
]);

/**
 * What the elements that became entries refer to that the files do not define: a feature of
 * another book, an option a rule asks for. Such a rule cannot work (a requirement that nothing
 * can meet, a trait that is never given), usually because the book it depends on was not read
 * with these. By entry id, the Aurora ids each one is missing.
 */
export function findUnresolved(ctx: Context, made: ReadonlySet<string>): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const source of ctx.needed) {
    if (!source.id || !made.has(source.id)) continue;
    const missing = new Set<string>();
    const check = (aid: string) => {
      if (aid && aid !== source.aid && !ctx.byAid.has(aid) && !UNDEFINED_IDS.has(aid))
        missing.add(aid);
    };
    for (const rule of readRules(source.el)) {
      if (rule.tag === "grant" && rule.type === "Spell") {
        if (
          rule.id &&
          !ctx.byAid.has(rule.id) &&
          !spellIdOf(ctx, rule.id) &&
          !UNDEFINED_IDS.has(rule.id)
        )
          missing.add(rule.id);
      } else if (rule.tag === "grant" && ELEMENT_TYPES.has(rule.type)) check(rule.id);
      for (const token of rule.supports.match(TOKEN) ?? []) check(token);
      for (const token of wanted(rule.requirements)) check(token);
    }
    for (const node of Array.from(source.el.querySelectorAll(":scope > supports")))
      for (const token of node.textContent?.match(TOKEN) ?? []) check(token);
    for (const node of Array.from(source.el.querySelectorAll(":scope > requirements")))
      for (const token of wanted(node.textContent ?? "")) check(token);
    if (missing.size > 0) found[source.id] = [...missing].sort();
  }
  return found;
}
