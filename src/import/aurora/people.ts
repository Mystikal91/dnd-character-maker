import type { Effect } from "../../data/schema";
import { emit } from "./emit";
import { type Context, FEATURE_TYPES, type Source, ofType, sharesTag } from "./registry";
import { mapRules, readRules, requirementsMet, selectMatches } from "./rules";
import { clean, description, setters, supportsOf } from "./xml";

/** Effects from rules, plus the traits or features the element grants right away. */
function baseEffects(ctx: Context, source: Source, prefix: string) {
  const mapped = mapRules(ctx, source, { idPrefix: prefix });
  const effects: Effect[] = [...mapped.effects];
  for (const grant of mapped.grants) {
    if (grant.source.id && grant.level === undefined)
      effects.push({ type: "trait", id: grant.source.id as `${string}:${string}/${string}` });
  }
  // "Choose two of these traits" (the half-elf's ability increases, a fighting style...).
  mapped.offers.forEach(({ rule, options }, i) => {
    if (rule.type === "Archetype" || rule.type === "Sub Race") return;
    const from = options.map((o) => o.id).filter((id): id is string => Boolean(id));
    if (from.length > 0)
      effects.push({
        type: "choice",
        id: `${prefix}-offer-${i + 1}`,
        choose: rule.number,
        grants: "trait",
        from,
      });
  });
  return { mapped, effects };
}

const LIST_FIELDS: Record<string, string> = {
  "personality trait": "personalityTraits",
  ideal: "ideals",
  bond: "bonds",
  flaw: "flaws",
};

export function importBackground(ctx: Context, source: Source): void {
  const { effects } = baseEffects(ctx, source, "background");
  const choose: Record<string, number> = {};
  const texts: Record<string, string | undefined> = { desc: description(source.el) };

  for (const rule of readRules(source.el)) {
    if (rule.tag !== "select" || rule.type !== "List") continue;
    const field = LIST_FIELDS[rule.name.toLowerCase()];
    if (!field || rule.items.length === 0) continue;
    choose[field] = rule.number;
    rule.items.forEach((text, n) => {
      if (source.id) ctx.result.strings[`${source.id}.${field}.${n + 1}`] = text;
    });
  }

  const feature = readRules(source.el)
    .filter((r) => r.tag === "grant" && r.type === "Background Feature")
    .filter((r) => requirementsMet(r.requirements))
    .map((r) => ctx.byAid.get(r.id))
    .find(Boolean);
  if (feature) {
    texts.featureName = feature.name.replace(/^feature:\s*/i, "");
    texts.featureDesc = description(feature.el);
  }
  emit(ctx, source, { choose }, texts, { effects });
}

export function importRace(ctx: Context, source: Source): void {
  const { mapped, effects } = baseEffects(ctx, source, "species");
  emit(
    ctx,
    source,
    {
      speed: mapped.speed ?? 30,
      size: mapped.size ?? "medium",
    },
    { desc: description(source.el) },
    { effects },
  );
}

/** True when the race, or a trait it grants (at any depth), offers this sub-race to pick. */
function offers(ctx: Context, race: Source, sub: Source): boolean {
  const seen = new Set<Source>();
  const stack = [race];
  while (stack.length > 0) {
    const here = stack.pop();
    if (!here || seen.has(here)) continue;
    seen.add(here);
    for (const rule of readRules(here.el)) {
      if (rule.tag === "select" && rule.type === "Sub Race" && selectMatches(rule.supports, sub))
        return true;
      const granted = rule.tag === "grant" ? ctx.byAid.get(rule.id) : undefined;
      if (granted && FEATURE_TYPES.has(rule.type)) stack.push(granted);
    }
  }
  return false;
}

/** The race a sub-race belongs to: the one its `supports` names, in this pack or in the app. */
function parentRace(ctx: Context, source: Source): string | undefined {
  const tags = supportsOf(source.el);
  // The race, or a trait it grants, says which sub-races it offers
  // (`select type="Sub Race" supports="MOTM Genasi"`).
  const offering = ofType(ctx, "Race").find((s) => s.id && offers(ctx, s, source));
  if (offering?.id) return offering.id;
  const inPack = ofType(ctx, "Race").find((s) => s.id && sharesTag([s.name], tags));
  if (inPack?.id) return inPack.id;
  for (const tag of tags) {
    const existing = ctx.existingByName.get(`species|${tag.toLowerCase()}`);
    if (existing) return existing;
  }
  return undefined;
}

export function importSubRace(ctx: Context, source: Source): void {
  const parent = parentRace(ctx, source);
  if (!parent) {
    ctx.result.skipped["Sub Race"] = (ctx.result.skipped["Sub Race"] ?? 0) + 1;
    return;
  }
  const { effects } = baseEffects(ctx, source, "subspecies");
  emit(ctx, source, {}, { desc: description(source.el) }, { effects, parent });
}

/** A racial trait, a feat feature or any other named option that has effects of its own. */
export function importTrait(ctx: Context, source: Source): void {
  const { effects } = baseEffects(ctx, source, "trait");
  emit(ctx, source, {}, { desc: description(source.el) }, { effects });
}

/** `[dex:13]` style requirements: the minimum ability scores a feat asks for. */
function prerequisites(el: Element): { ability: string; minimum: number }[] {
  const text = clean(el.querySelector(":scope > requirements")?.textContent);
  return [...text.matchAll(/\[(str|dex|con|int|wis|cha):(\d+)\]/g)].map((m) => ({
    ability: m[1] ?? "",
    minimum: Number(m[2]),
  }));
}

export function importFeat(ctx: Context, source: Source): void {
  const { effects } = baseEffects(ctx, source, "feat");
  const requirements = clean(source.el.querySelector(":scope > requirements")?.textContent);
  emit(
    ctx,
    source,
    { prerequisites: prerequisites(source.el), requirements },
    { desc: description(source.el) },
    { effects },
  );
}

const ALIGNMENT_CODES: Record<string, string> = {
  LG: "lawful-good",
  NG: "neutral-good",
  CG: "chaotic-good",
  LN: "lawful-neutral",
  N: "neutral",
  CN: "chaotic-neutral",
  LE: "lawful-evil",
  NE: "neutral-evil",
  CE: "chaotic-evil",
};

/** A deity: who it is in a line (setting, alignment, domains, symbol) and what the book says. */
export function importDeity(ctx: Context, source: Source): void {
  const set = setters(source.el);
  const slug = ALIGNMENT_CODES[(set.get("alignment")?.text ?? "").toUpperCase()];
  const alignmentId = `srd51:alignment/${slug}`;
  const alignment = slug && ctx.options.index.has(alignmentId) ? alignmentId : undefined;
  const domains = set.get("domains")?.text ?? "";
  const symbol = set.get("symbol")?.text ?? "";
  const facts = [
    set.get("setting")?.text,
    alignment ? ctx.options.nameOf(alignment) : undefined,
    domains ? `Domains: ${domains}` : undefined,
    symbol ? `Symbol: ${symbol}` : undefined,
  ].filter(Boolean);
  emit(
    ctx,
    source,
    { ...(alignment && { alignment }), ...(domains && { domains }) },
    { desc: [facts.join(" \u00b7 "), description(source.el)].filter(Boolean).join("\n\n") },
  );
}
