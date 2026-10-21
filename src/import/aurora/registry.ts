import type { Entry } from "../../data/schema";
import { clean, slugify, supportsOf } from "./xml";

export interface AuroraOptions {
  /** Id of the pack the entries are created in, e.g. `imp1a2b3c`. */
  packId: string;
  /** Everything the app already has, so references can be checked and duplicates skipped. */
  index: ReadonlyMap<string, Entry>;
  /** The display name of an entry of the app (used to recognise duplicates by name). */
  nameOf: (id: string) => string;
}

export interface AuroraResult {
  entries: Entry[];
  /** Texts keyed by `<entry id>.<field>`. */
  strings: Record<string, string>;
  /** Names of the books or sources the elements say they come from. */
  sources: string[];
  /** Elements that were not imported, by Aurora type (`Deity`, `Companion`, ...). */
  skipped: Record<string, number>;
  /** Elements the app already has, so they were left out. */
  duplicates: number;
  /** Rules (stat formulas, conditions...) that the app cannot apply by itself. */
  unsupportedRules: number;
  /** The name the files give themselves, if any. */
  title: string;
}

/** One `<element>` of an Aurora file. */
export interface Source {
  el: Element;
  type: string;
  name: string;
  /** The Aurora id, e.g. `ID_PHB_SPELL_ALARM`. */
  aid: string;
  source: string;
  /** The kind of entry it becomes, when it becomes one. */
  kind?: string;
  /** The id in the app: a new one in this pack, or the one of an entry the app already has. */
  id?: string;
  /** True when the app already has it, so nothing new is created. */
  existing?: boolean;
}

export interface Context {
  options: AuroraOptions;
  result: AuroraResult;
  /** Every element of the files, by Aurora id. */
  byAid: Map<string, Source>;
  all: Source[];
  /** The same elements, by Aurora type: the files can hold fifteen thousand of them. */
  byType: Map<string, Source[]>;
  /** Elements that must be created, in file order. */
  needed: Set<Source>;
  usedSlugs: Set<string>;
  /** Entries of the app by kind and lowercase name. */
  existingByName: Map<string, string>;
}

/** The kind of entry each Aurora element type becomes. Types not listed here are skipped. */
export const KIND_OF: Record<string, string> = {
  Spell: "spell",
  Weapon: "item",
  Armor: "item",
  Item: "item",
  "Magic Item": "item",
  Deity: "deity",
  Language: "language",
  Background: "background",
  Race: "species",
  "Sub Race": "subspecies",
  "Racial Trait": "trait",
  Feat: "feat",
  "Feat Feature": "trait",
  Class: "class",
  "Class Feature": "feature",
  Archetype: "subclass",
  "Archetype Feature": "feature",
};

/** Element types that start something on their own, as opposed to being granted by another. */
export const ROOT_TYPES = new Set([
  "Spell",
  "Weapon",
  "Armor",
  "Item",
  "Magic Item",
  "Deity",
  "Language",
  "Background",
  "Race",
  "Sub Race",
  "Feat",
  "Class",
  "Archetype",
]);

/** Types that are granted or offered by other elements. */
export const FEATURE_TYPES = new Set([
  "Racial Trait",
  "Class Feature",
  "Archetype Feature",
  "Background Feature",
  "Feat Feature",
]);

/** Builds the lookup of the app's entries by kind and name, to recognise what it already has. */
export function indexExisting(options: AuroraOptions): Map<string, string> {
  const found = new Map<string, string>();
  for (const entry of options.index.values()) {
    if (!/^srd\d+:/.test(entry.id)) continue; // only content that ships with the app
    found.set(`${entry.kind}|${options.nameOf(entry.id).toLowerCase()}`, entry.id);
  }
  return found;
}

export function readSources(doc: Document): Source[] {
  const sources: Source[] = [];
  for (const el of Array.from(doc.documentElement.getElementsByTagName("element"))) {
    const aid = el.getAttribute("id") ?? "";
    const type = el.getAttribute("type") ?? "";
    const name = clean(el.getAttribute("name"));
    if (aid && type)
      sources.push({ el, type, name, aid, source: clean(el.getAttribute("source")) });
  }
  return sources;
}

/** Aurora's `supports` text of a rule, as tags (`Standard||Exotic` becomes two tags). */
export function tagsOf(text: string | null | undefined): string[] {
  return clean(text)
    .split(/\s*(?:,|\|\||\|)\s*/)
    .filter(Boolean);
}

/** True when two lists of tags share one, ignoring case. */
export const sharesTag = (a: string[], b: string[]) => {
  const lower = new Set(a.map((t) => t.toLowerCase()));
  return b.some((t) => lower.has(t.toLowerCase()));
};

/** Allocates the id of an element: its slug, made unique among the pack's entries. */
export function allocate(ctx: Context, source: Source): void {
  const kind = KIND_OF[source.type];
  if (!kind || source.id) return;
  const base = slugify(source.name);
  if (!base) return;
  let slug = base;
  for (let n = 2; ctx.usedSlugs.has(`${kind}/${slug}`); n++) slug = `${base}-${n}`;
  ctx.usedSlugs.add(`${kind}/${slug}`);
  source.kind = kind;
  source.id = `${ctx.options.packId}:${kind}/${slug}`;
}

/** The elements of one type, in file order. */
export const ofType = (ctx: Context, type: string): Source[] => ctx.byType.get(type) ?? [];

const tagCache = new WeakMap<Source, string[]>();

/** The supports tags of an element (what it can be selected as). Read once per element. */
export function elementTags(source: Source): string[] {
  let tags = tagCache.get(source);
  if (!tags) {
    tags = supportsOf(source.el);
    tagCache.set(source, tags);
  }
  return tags;
}
