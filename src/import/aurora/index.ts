import { type Owner, claimFeatures, importArchetype, importClass, importFeature } from "./classes";
import {
  importArmor,
  importGear,
  importLanguage,
  importMagicItem,
  importSpell,
  importWeapon,
} from "./items";
import {
  importBackground,
  importDeity,
  importFeat,
  importRace,
  importRaceVariant,
  importSubRace,
  importTrait,
} from "./people";
import {
  type AuroraOptions,
  type AuroraResult,
  type Context,
  FEATURE_TYPES,
  KIND_OF,
  ROOT_TYPES,
  type Source,
  allocate,
  indexExisting,
  ofType,
  readSources,
} from "./registry";
import { mergeRepeats, preferOlderEdition } from "./repeats";
import { readRules, requirementsMet, selectMatches } from "./rules";
import { AuroraParseError, clean } from "./xml";

export { AuroraParseError, slugify } from "./xml";

/**
 * The version of what the importer produces. Raise it whenever a change to the importer changes
 * the entries or texts it makes: packs imported with an older version are marked as needing an
 * update, and can be imported again with a click.
 */
export const AURORA_IMPORT_VERSION = 1;
export type { AuroraOptions, AuroraResult } from "./registry";

/**
 * Reads files in the XML format that the Aurora character builder uses, so that people can bring
 * content they already have. Nothing here knows any book's content: it only translates structure.
 *
 * Supported: spells, weapons, armor, gear, languages, backgrounds, races and sub-races with their
 * traits, feats, classes and archetypes with their features. Other types (deities, companions,
 * magic items...) are counted and reported as skipped.
 */
/** Elements that only exist to be picked by another one: nothing to report when not imported. */
const SILENT_TYPES = new Set([
  "Background Feature",
  "Multiclass",
  "Ability Score Improvement",
  // Definitions the reader uses by itself, or that only describe the program's own settings:
  // the books, the proficiency and vision definitions, flags other elements test for.
  "Source",
  "Proficiency",
  "Rule",
  "Alignment",
  "Vision",
  "Weapon Group",
  "Weapon Property",
  "Option",
  "Support",
  "Grants",
  // A dragonmark only says which flag it sets; the variants that use it carry the rules.
  "Dragonmark",
]);

/** Kinds a person picks from a list, where two entries with one name cannot be told apart. */
const LISTED_KINDS = new Set([
  "species",
  "subspecies",
  "spell",
  "feat",
  "background",
  "item",
  "class",
  "subclass",
  "language",
  "deity",
]);

/**
 * Items that exist only so Aurora can keep its books (feat unlockers, the packs a class or a
 * background starts with, selections of a companion): nothing a character carries.
 */
function isBookkeeping(source: Source): boolean {
  if (source.type !== "Item" && source.type !== "Magic Item") return false;
  return (
    source.source === "Internal" ||
    source.aid.startsWith("ID_INTERNAL_") ||
    /\b(feat unlocker|equipment pack)\b/i.test(source.name)
  );
}

/**
 * The same name can come from two books (Kobold in Volo's Guide and in Monsters of the
 * Multiverse, or a spell reprinted in a later book). Those get the book in brackets, so a list
 * shows which one is which. A name that is alone keeps its plain name.
 */
function nameSameNames(ctx: Context): void {
  const groups = new Map<string, Source[]>();
  for (const source of ctx.needed) {
    if (!source.id || !source.kind || !LISTED_KINDS.has(source.kind)) continue;
    const key = `${source.kind}|${source.name.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), source]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const source of group) {
      if (source.source)
        ctx.result.strings[`${source.id}.name`] = `${source.name} (${source.source})`;
    }
  }
}

/**
 * The same variant can exist for several species (the Mark of Finding for humans and for
 * half-orcs): those get the species in brackets, whatever book they come from.
 */
function nameVariantsBySpecies(ctx: Context): void {
  const parents = new Map(ctx.result.entries.map((e) => [e.id, e.parent]));
  const groups = new Map<string, Source[]>();
  for (const source of ctx.needed) {
    if (source.type !== "Race Variant" || !source.id || !parents.get(source.id)) continue;
    const key = source.name.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), source]);
  }
  for (const group of groups.values()) {
    const species = new Set(group.map((s) => parents.get(s.id ?? "")));
    if (group.length < 2 || species.size < 2) continue;
    for (const source of group) {
      const parent = parents.get(source.id ?? "") ?? "";
      const name = ctx.result.strings[`${parent}.name`] ?? ctx.options.nameOf(parent);
      ctx.result.strings[`${source.id}.name`] = `${source.name} (${name})`;
    }
  }
}

export function parseAurora(files: string[], options: AuroraOptions): AuroraResult {
  const result: AuroraResult = {
    entries: [],
    strings: {},
    sources: [],
    skipped: {},
    duplicates: 0,
    merged: 0,
    editions: 0,
    unsupportedRules: 0,
    title: "",
  };
  const ctx: Context = {
    options,
    result,
    byAid: new Map(),
    all: [],
    byType: new Map(),
    needed: new Set(),
    usedSlugs: new Set(),
    existingByName: indexExisting(options),
  };

  for (const text of files) {
    const doc = new DOMParser().parseFromString(text.replace(/^﻿/, ""), "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0)
      throw new AuroraParseError("The file is not valid XML");
    const root = doc.documentElement;
    if (!root || root.tagName !== "elements")
      throw new AuroraParseError("Not an Aurora elements file");
    result.title ||= clean(root.querySelector("info > name")?.textContent);
    for (const source of readSources(doc)) {
      if (ctx.byAid.has(source.aid)) continue;
      ctx.byAid.set(source.aid, source);
      ctx.all.push(source);
      const same = ctx.byType.get(source.type);
      if (same) same.push(source);
      else ctx.byType.set(source.type, [source]);
    }
  }

  // What the app already has stays as it is; other roots are what the files are about.
  for (const source of ctx.all) {
    const kind = KIND_OF[source.type];
    if (!kind) continue;
    if (ROOT_TYPES.has(source.type)) {
      if (isBookkeeping(source)) continue;
      const existing = ctx.existingByName.get(`${kind}|${source.name.toLowerCase()}`);
      if (existing) {
        source.id = existing;
        source.kind = kind;
        source.existing = true;
        result.duplicates += 1;
        continue;
      }
      ctx.needed.add(source);
    }
  }

  // Features, traits and the like are created only when something that is created uses them.
  const mark = (source: Source | undefined) => {
    if (!source || source.existing || ctx.needed.has(source)) return;
    ctx.needed.add(source);
    visit(source);
  };
  const visit = (source: Source) => {
    for (const rule of readRules(source.el)) {
      if (!requirementsMet(rule.requirements)) continue;
      if (rule.tag === "grant" && FEATURE_TYPES.has(rule.type)) mark(ctx.byAid.get(rule.id));
      else if (rule.tag === "select" && FEATURE_TYPES.has(rule.type))
        for (const option of ofType(ctx, rule.type))
          if (selectMatches(rule.supports, option)) mark(option);
    }
  };
  for (const source of [...ctx.needed]) visit(source);

  // Ids, in the order of the files.
  for (const source of ctx.all) if (ctx.needed.has(source)) allocate(ctx, source);
  // Entries that are needed but could not get an id (no name) are dropped.
  for (const source of [...ctx.needed]) if (!source.id) ctx.needed.delete(source);

  const owners = new Map<Source, Owner>();
  claimFeatures(ctx, owners);

  for (const source of ctx.all) {
    if (!ctx.needed.has(source)) {
      if (!KIND_OF[source.type] && !SILENT_TYPES.has(source.type))
        result.skipped[source.type] = (result.skipped[source.type] ?? 0) + 1;
      continue;
    }
    switch (source.type) {
      case "Spell":
        importSpell(ctx, source);
        break;
      case "Weapon":
        importWeapon(ctx, source);
        break;
      case "Armor":
        importArmor(ctx, source);
        break;
      case "Item":
        importGear(ctx, source);
        break;
      case "Magic Item":
        importMagicItem(ctx, source);
        break;
      case "Deity":
        importDeity(ctx, source);
        break;
      case "Language":
        importLanguage(ctx, source);
        break;
      case "Background":
        importBackground(ctx, source);
        break;
      case "Race":
        importRace(ctx, source);
        break;
      case "Sub Race":
        importSubRace(ctx, source);
        break;
      case "Race Variant":
        importRaceVariant(ctx, source);
        break;
      case "Racial Trait":
      case "Feat Feature":
        importTrait(ctx, source);
        break;
      case "Feat":
        importFeat(ctx, source);
        break;
      case "Class":
        importClass(ctx, source);
        break;
      case "Class Feature":
      case "Archetype Feature":
        importFeature(ctx, source, owners);
        break;
      case "Archetype":
        importArchetype(ctx, source);
        break;
    }
  }

  result.editions = options.keepEditions ? 0 : preferOlderEdition(ctx);
  result.merged = mergeRepeats(ctx);
  nameSameNames(ctx);
  nameVariantsBySpecies(ctx);
  result.sources = [...new Set(result.sources)].sort();
  return result;
}
