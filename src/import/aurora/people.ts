import type { Effect } from "../../data/schema";
import { emit } from "./emit";
import { type Context, FEATURE_TYPES, type Source, ofType, sharesTag } from "./registry";
import { mapRules, readRules, requirementsMet, selectMatches, translateRequirement } from "./rules";
import { clean, description, setters, supportsOf } from "./xml";

/** Effects from rules, plus the traits or features the element grants right away. */
function baseEffects(ctx: Context, source: Source, prefix: string, holds?: ReadonlySet<string>) {
  // With nothing assumed to be held, a rule with a requirement stays in, behind a `when` that is
  // checked with the sheet; with `holds` the requirement is decided now and the rule is in or out.
  const live = !holds;
  const mapped = mapRules(ctx, source, { idPrefix: prefix, live, ...(holds && { holds }) });
  const effects: Effect[] = [...mapped.effects];
  const gate = (requires: string | undefined, effect: Effect): Effect =>
    requires ? { type: "when", requires, effects: [effect] } : effect;
  for (const grant of mapped.grants) {
    if (grant.source.id && grant.level === undefined)
      effects.push(
        gate(grant.requires, {
          type: "trait",
          id: grant.source.id as `${string}:${string}/${string}`,
        }),
      );
  }
  // "Choose two of these traits" (the half-elf's ability increases, a fighting style...).
  mapped.offers.forEach(({ rule, options }, i) => {
    if (rule.type === "Archetype" || rule.type === "Sub Race") return;
    const from = options.map((o) => o.id).filter((id): id is string => Boolean(id));
    if (from.length > 0)
      effects.push(
        gate(
          live && rule.requirements.trim()
            ? translateRequirement(ctx, rule.requirements)
            : undefined,
          {
            type: "choice",
            id: `${prefix}-offer-${i + 1}`,
            choose: rule.number,
            grants: "trait",
            from,
          },
        ),
      );
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
function offers(ctx: Context, race: Source, sub: Source, selects = "Sub Race"): boolean {
  const seen = new Set<Source>();
  const stack = [race];
  while (stack.length > 0) {
    const here = stack.pop();
    if (!here || seen.has(here)) continue;
    seen.add(here);
    for (const rule of readRules(here.el)) {
      if (rule.tag === "select" && rule.type === selects && selectMatches(rule.supports, sub))
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
  // A sub-race can set a flag that rules of the race test for ("unless you have a sub-race"):
  // the Tiefling's ability increase and legacy give way to the ones of its sub-race. A race of
  // this pack keeps those rules behind a `when` and the sub-race just sets its flags. A race the
  // app already has cannot be changed, so the sub-race stands in for the species, like a variant,
  // instead of adding to it.
  // Several races can be the same one of the app (the Tiefling of 2014 and of 2024): the one
  // that offers this sub-race is the parent, not the first with the same id.
  const sameId = ofType(ctx, "Race").filter((s) => s.id === parent);
  const parentSource = sameId.find((s) => offers(ctx, s, source)) ?? sameId[0];
  const holds = flagsOf(ctx, source);
  if (parentSource?.existing && takesAway(ctx, parentSource, holds)) {
    const own = baseEffects(ctx, source, "subspecies", holds).effects;
    const appEntry = parentSource.existing ? ctx.options.index.get(parent) : undefined;
    const base = appEntry
      ? withoutRemoved(ctx, parentSource, holds, appEntry.effects)
      : baseEffects(ctx, parentSource, "subspecies-base", holds).effects;
    emit(
      ctx,
      source,
      { replacesSpecies: true },
      { desc: description(source.el) },
      { effects: [...base, ...own], parent },
    );
    return;
  }
  const { effects } = baseEffects(ctx, source, "subspecies");
  emit(ctx, source, {}, { desc: description(source.el) }, { effects, parent });
}

/** True when setting these flags takes away rules that the race has without them. */
function takesAway(ctx: Context, race: Source, holds: ReadonlySet<string>): boolean {
  const counted = ctx.result.unsupportedRules;
  const before = mapRules(ctx, race, { idPrefix: "species" });
  const after = mapRules(ctx, race, { idPrefix: "species", holds });
  ctx.result.unsupportedRules = counted; // only looking, nothing to report twice
  const kept = after.effects.map((e) => JSON.stringify(e));
  const lostEffect = before.effects.some((e) => {
    const at = kept.indexOf(JSON.stringify(e));
    if (at < 0) return true;
    kept.splice(at, 1);
    return false;
  });
  const lostGrant = before.grants.some((g) => !after.grants.some((a) => a.source === g.source));
  return lostEffect || lostGrant;
}

/**
 * The flags an element sets (`grant type="Grants"`), which other rules test for, including those
 * set by what it grants in turn (a variant that grants a dragonmark, which sets the flag).
 */
function flagsOf(ctx: Context, source: Source): Set<string> {
  const flags = new Set<string>();
  const seen = new Set<Source>();
  const stack = [source];
  while (stack.length > 0) {
    const here = stack.pop();
    if (!here || seen.has(here)) continue;
    seen.add(here);
    flags.add(here.aid); // a chosen element counts as held, too
    for (const rule of readRules(here.el)) {
      if (rule.tag !== "grant") continue;
      if (rule.type === "Grants") flags.add(rule.id);
      else {
        const granted = ctx.byAid.get(rule.id);
        if (granted) stack.push(granted);
      }
    }
  }
  return flags;
}

/** What a species of the app loses when the flags are set: the rules that said "unless". */
function withoutRemoved(
  ctx: Context,
  parent: Source,
  holds: ReadonlySet<string>,
  effects: Effect[],
): Effect[] {
  const counted = ctx.result.unsupportedRules;
  const before = mapRules(ctx, parent, { idPrefix: "species" });
  const after = mapRules(ctx, parent, { idPrefix: "species", holds });
  ctx.result.unsupportedRules = counted; // only looking, nothing to report twice

  const kept = [...effects];
  const drop = (match: (e: Effect) => boolean) => {
    const at = kept.findIndex(match);
    if (at >= 0) kept.splice(at, 1);
  };
  const remaining = [...after.effects];
  for (const gone of before.effects) {
    const same = remaining.findIndex((e) => JSON.stringify(e) === JSON.stringify(gone));
    if (same >= 0) remaining.splice(same, 1);
    else drop((e) => JSON.stringify(e) === JSON.stringify(gone));
  }
  for (const grant of before.grants) {
    if (after.grants.some((g) => g.source === grant.source)) continue;
    const id =
      grant.source.id ?? ctx.existingByName.get(`trait|${grant.source.name.toLowerCase()}`);
    if (id) drop((e) => e.type === "trait" && e.id === id);
  }
  return kept;
}

/**
 * A variant of a race (the half-elf of the Sword Coast, a dragonborn of Wildemount, a race with a
 * dragonmark) replaces some of the race's traits. Of a race in this pack it is a sub-species that
 * only adds, the race holding what the variant takes away behind a `when`. Of a race the app has
 * already, it carries the race's effects without what the variant takes away, plus its own, and
 * says it stands in for the species.
 */
export function importRaceVariant(ctx: Context, source: Source): void {
  const parent = ofType(ctx, "Race").find((s) => s.id && offers(ctx, s, source, "Race Variant"));
  if (!parent?.id) {
    ctx.result.skipped["Race Variant"] = (ctx.result.skipped["Race Variant"] ?? 0) + 1;
    return;
  }
  if (!parent.existing) {
    // The race keeps what the variant takes away behind a `when`: the variant only adds.
    const { effects } = baseEffects(ctx, source, "variant");
    emit(ctx, source, {}, { desc: description(source.el) }, { effects, parent: parent.id });
    return;
  }
  const holds = flagsOf(ctx, source);
  const own = baseEffects(ctx, source, "variant", holds).effects;
  const appEntry = parent.existing ? ctx.options.index.get(parent.id) : undefined;
  const base = appEntry
    ? withoutRemoved(ctx, parent, holds, appEntry.effects)
    : baseEffects(ctx, parent, "variant-base", holds).effects;
  emit(
    ctx,
    source,
    { replacesSpecies: true },
    { desc: description(source.el) },
    { effects: [...base, ...own], parent: parent.id },
  );
}

/** A rule a table switches on for a character: it is held by the character that has it. */
export function importOption(ctx: Context, source: Source): void {
  const { effects } = baseEffects(ctx, source, "option");
  // Held by its Aurora id as well, for rules of another pack that ask for it by that name.
  emit(
    ctx,
    source,
    {},
    { desc: description(source.el) },
    { effects: [{ type: "flag", id: source.aid }, ...effects] },
  );
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
