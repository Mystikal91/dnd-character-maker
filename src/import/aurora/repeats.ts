import type { Entry } from "../../data/schema";
import type { Context } from "./registry";

/**
 * Text compared by its words: spacing, case, quotes and punctuation do not count, so a colon
 * where another printing has a full stop does not make a second spell.
 */
const plain = (text: string) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** The texts of each entry, by entry id. */
function textsByEntry(strings: Record<string, string>): Map<string, [string, string][]> {
  const found = new Map<string, [string, string][]>();
  for (const [key, value] of Object.entries(strings)) {
    const dot = key.indexOf(".");
    if (dot < 0) continue;
    const id = key.slice(0, dot);
    const list = found.get(id) ?? [];
    list.push([key.slice(dot + 1), value]);
    found.set(id, list);
  }
  return found;
}

/**
 * What makes two entries the same: kind, name, text, effects and data. The raw `requirements`
 * text is left out: a feat that can be taken again is written as copies, each asking for the
 * one before it, and those are one feat.
 */
function signature(entry: Entry, texts: [string, string][] | undefined): string {
  const body = (texts ?? [])
    .map(([field, value]) => [field, plain(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  // The classes that have a spell grow with each book that adds some (the artificer came later):
  // the same spell with another list of classes is the same spell, with all the classes.
  const { requirements: _raw, classes: _classes, ...data } = entry.data as Record<string, unknown>;
  if (entry.kind !== "spell") Object.assign(data, { classes: _classes });
  return JSON.stringify([entry.kind, entry.parent ?? null, entry.effects, data, body]);
}

/** Replaces ids in anything made of objects, arrays and strings; arrays lose repeated ids. */
function remap(value: unknown, replace: ReadonlyMap<string, string>): unknown {
  if (typeof value === "string") return replace.get(value) ?? value;
  if (Array.isArray(value)) {
    const mapped = value.map((v) => remap(v, replace));
    const strings = mapped.filter((v): v is string => typeof v === "string");
    if (strings.length === mapped.length) return [...new Set(mapped)];
    return mapped;
  }
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remap(v, replace)]));
  return value;
}

/** Takes the entries out and points whatever referred to them at the ones that replace them. */
function drop(ctx: Context, replace: ReadonlyMap<string, string>): void {
  const result = ctx.result;
  result.entries = result.entries
    .filter((entry) => !replace.has(entry.id))
    .map((entry) => remap(entry, replace) as Entry);
  for (const key of Object.keys(result.strings)) {
    if (replace.has(key.slice(0, key.indexOf(".")))) delete result.strings[key];
  }
  for (const source of [...ctx.needed]) {
    if (source.id && replace.has(source.id)) ctx.needed.delete(source);
  }
  // What was made from a dropped element is now the entry that took its place.
  for (const [aid, id] of Object.entries(result.aids)) {
    const kept = replace.get(id);
    if (kept) result.aids[aid] = kept;
  }
}

/** The kinds people pick from a list: a re-edited feature or trait is not a second choice. */
const LISTED = new Set([
  "spell",
  "feat",
  "item",
  "species",
  "subspecies",
  "background",
  "class",
  "subclass",
  "language",
  "deity",
]);

const is2024 = (source: { source: string; aid: string }) =>
  /\(2024\)/.test(source.source) || /^ID_[A-Z]+_[A-Z0-9]*24_/.test(source.aid);

/**
 * The books of 2024 repeat much of the 2014 ones with new words. This app follows the 2014
 * rules, so when something has both versions the 2014 one stays and the 2024 one is left out
 * (what refers to it points at the 2014 one). Things that exist only in 2024 stay. Returns how
 * many entries were left out.
 */
export function preferOlderEdition(ctx: Context): number {
  const modern = new Map<string, boolean>();
  const aidOf = new Map<string, string>();
  for (const source of ctx.needed) {
    if (!source.id) continue;
    modern.set(source.id, is2024(source));
    aidOf.set(source.id, source.aid);
  }
  const byId = new Map(ctx.result.entries.map((e) => [e.id, e]));
  const groups = new Map<string, { old: string[]; fresh: string[] }>();
  for (const entry of ctx.result.entries) {
    if (!LISTED.has(entry.kind) || !modern.has(entry.id)) continue;
    const key = `${entry.kind}|${plain(ctx.result.strings[`${entry.id}.name`] ?? "")}`;
    const group = groups.get(key) ?? { old: [], fresh: [] };
    group[modern.get(entry.id) ? "fresh" : "old"].push(entry.id);
    groups.set(key, group);
  }
  const replace = new Map<string, string>();
  for (const { old, fresh } of groups.values()) {
    // Two 2014 things can share a name (the Blessing of Protection of the DMG and the one of the
    // Gift): the 2024 one is the one with the same effects, else the first by Aurora id, never
    // the first that the files happened to list.
    const sorted = [...old].sort((x, y) => (aidOf.get(x) ?? x).localeCompare(aidOf.get(y) ?? y));
    for (const id of fresh) {
      const effects = JSON.stringify(byId.get(id)?.effects);
      const keep =
        sorted.find((o) => JSON.stringify(byId.get(o)?.effects) === effects) ?? sorted[0];
      if (keep) replace.set(id, keep);
    }
  }
  if (replace.size > 0) drop(ctx, replace);
  return replace.size;
}

/**
 * The same element often comes from several books (a spell reprinted, a feat in two editions
 * with the same words). Entries with one name that say exactly the same, in text and in effects,
 * become one, and whatever pointed at the others points at the one that stays. An entry that
 * differs in any word stays, so the people who want that version can pick it. Entries that
 * only differed by pointing at repeats are the same after one pass, so it goes on until nothing
 * more merges. Returns how many entries were merged away.
 */
export function mergeRepeats(ctx: Context): number {
  const result = ctx.result;
  let merged = 0;
  for (let round = 0; round < 8; round++) {
    const texts = textsByEntry(result.strings);
    const first = new Map<string, string>();
    const replace = new Map<string, string>();
    for (const entry of result.entries) {
      const name = plain(result.strings[`${entry.id}.name`] ?? "");
      if (!name) continue;
      const key = `${name}|${signature(entry, texts.get(entry.id))}`;
      const kept = first.get(key);
      if (kept) replace.set(entry.id, kept);
      else first.set(key, entry.id);
    }
    if (replace.size === 0) break;

    // A spell kept takes the classes of the copies that go.
    const byId = new Map(result.entries.map((e) => [e.id, e]));
    for (const [gone, kept] of replace) {
      const to = byId.get(kept);
      const from = byId.get(gone);
      if (to?.kind !== "spell" || from?.kind !== "spell") continue;
      const classes = new Set([
        ...((to.data.classes as string[] | undefined) ?? []),
        ...((from.data.classes as string[] | undefined) ?? []),
      ]);
      to.data = { ...to.data, classes: [...classes] };
    }
    drop(ctx, replace);
    merged += replace.size;
  }
  return merged;
}
