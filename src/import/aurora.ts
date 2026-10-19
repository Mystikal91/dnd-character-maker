import type { Entry } from "../data/schema";

/**
 * Reads files in the XML format that the Aurora character builder uses, so that people can bring
 * content they already have. Nothing here knows any book's content: it only translates structure.
 *
 * Supported: spells, weapons, armor, adventuring gear and languages. Everything else (races,
 * classes, feats, magic items...) is counted and reported as skipped.
 */

export class AuroraParseError extends Error {}

export interface AuroraOptions {
  /** Id of the pack the entries are created in, e.g. `imp1a2b3c`. */
  packId: string;
  /** Ids that exist in the app, so references (classes, weapon properties) can be checked. */
  known: ReadonlySet<string>;
  /** True when the app already has this entry (same kind and name), so it is not added again. */
  exists?: (kind: string, name: string) => boolean;
}

export interface AuroraResult {
  entries: Entry[];
  /** Texts keyed by `<entry id>.<field>`. */
  strings: Record<string, string>;
  /** Names of the books or sources the elements say they come from. */
  sources: string[];
  /** Elements that were not imported, by Aurora type (`Race`, `Class`, ...). */
  skipped: Record<string, number>;
  /** Elements the app already has, so they were left out. */
  duplicates: number;
  /** The name the files give themselves, if any. */
  title: string;
}

export const slugify = (text: string): string =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/['’`]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const clean = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

/** The visible text of a description: paragraphs, with list items as `- item`. */
function paragraphs(description: Element | null): string[] {
  if (!description) return [];
  const out: string[] = [];
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag === "p") out.push(clean(child.textContent));
      else if (tag === "ul" || tag === "ol")
        for (const li of Array.from(child.children)) out.push(`- ${clean(li.textContent)}`);
      else if (tag === "table")
        continue; // tables do not survive as plain text
      else walk(child);
    }
  };
  walk(description);
  return out.filter((p) => p !== "" && p !== "- ");
}

function setters(element: Element): Map<string, { text: string; attrs: Element }> {
  const found = new Map<string, { text: string; attrs: Element }>();
  for (const set of Array.from(element.querySelectorAll("setters > set"))) {
    const name = set.getAttribute("name");
    if (name) found.set(name, { text: clean(set.textContent), attrs: set });
  }
  return found;
}

const number = (text: string): number | undefined => {
  const n = Number.parseFloat(text.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

/** Cost in copper, silver or gold: electrum and platinum are converted. */
function parseCost(set: { text: string; attrs: Element } | undefined) {
  const amount = number(set?.text ?? "");
  if (amount === undefined) return { amount: 0, unit: "gp" as const };
  const currency = set?.attrs.getAttribute("currency")?.toLowerCase() ?? "gp";
  if (currency === "cp" || currency === "sp" || currency === "gp")
    return { amount, unit: currency };
  if (currency === "ep") return { amount: amount * 5, unit: "sp" as const };
  if (currency === "pp") return { amount: amount * 10, unit: "gp" as const };
  return { amount, unit: "gp" as const };
}

function parseWeight(set: { text: string; attrs: Element } | undefined): number | undefined {
  const lb = set?.attrs.getAttribute("lb");
  return lb ? number(lb) : number(set?.text ?? "");
}

const PROPERTY_ALIASES: Record<string, string> = { twohanded: "two-handed" };

interface Context {
  options: AuroraOptions;
  result: AuroraResult;
  used: Set<string>;
}

function addEntry(
  ctx: Context,
  kind: string,
  name: string,
  data: Record<string, unknown>,
  texts: Record<string, string | undefined>,
): void {
  const base = slugify(name);
  if (!base) return;
  let slug = base;
  for (let n = 2; ctx.used.has(`${kind}/${slug}`); n++) slug = `${base}-${n}`;
  ctx.used.add(`${kind}/${slug}`);
  const id = `${ctx.options.packId}:${kind}/${slug}`;
  ctx.result.entries.push({ id, kind, effects: [], data } as Entry);
  ctx.result.strings[`${id}.name`] = name;
  for (const [field, value] of Object.entries(texts))
    if (value) ctx.result.strings[`${id}.${field}`] = value;
}

function importSpell(ctx: Context, element: Element, name: string): void {
  const set = setters(element);
  const level = number(set.get("level")?.text ?? "") ?? 0;
  const classes = clean(element.querySelector("supports")?.textContent)
    .split(",")
    .map((c) => `srd51:class/${slugify(c)}`)
    .filter((id) => ctx.options.known.has(id));
  const components = [
    set.get("hasVerbalComponent")?.text === "true" && "V",
    set.get("hasSomaticComponent")?.text === "true" && "S",
    set.get("hasMaterialComponent")?.text === "true" && "M",
  ].filter(Boolean);

  const text = paragraphs(element.querySelector("description"));
  const higherIndex = text.findIndex((p) => /^at higher levels\.?/i.test(p));
  const higher = higherIndex >= 0 ? text.splice(higherIndex, 1)[0] : undefined;

  addEntry(
    ctx,
    "spell",
    name,
    {
      level,
      school: slugify(set.get("school")?.text ?? ""),
      components,
      ritual: set.get("isRitual")?.text === "true",
      concentration: set.get("isConcentration")?.text === "true",
      classes,
    },
    {
      desc: text.join("\n\n"),
      higherLevel: higher?.replace(/^at higher levels\.?\s*/i, ""),
      castingTime: set.get("time")?.text,
      range: set.get("range")?.text,
      duration: set.get("duration")?.text,
      material: set.get("materialComponent")?.text,
    },
  );
}

function importWeapon(ctx: Context, element: Element, name: string): void {
  const set = setters(element);
  const supports = clean(element.querySelector("supports")?.textContent).split(/\s*,\s*/);
  const category = supports.join(" ").match(/WEAPON_CATEGORY_(SIMPLE|MARTIAL)_(MELEE|RANGED)/);
  if (!category) {
    ctx.result.skipped.Weapon = (ctx.result.skipped.Weapon ?? 0) + 1;
    return;
  }
  const weaponCategory = category[1]?.toLowerCase() as "simple" | "martial";
  const kind = category[2]?.toLowerCase() as "melee" | "ranged";
  const properties = supports
    .map((s) => s.match(/^ID_INTERNAL_WEAPON_PROPERTY_([A-Z]+)$/)?.[1]?.toLowerCase())
    .filter((p): p is string => Boolean(p))
    .map((p) => `srd51:property/${PROPERTY_ALIASES[p] ?? p}`)
    .filter((id) => ctx.options.known.has(id));

  const dice = set.get("damage")?.text ?? "";
  const damageType = set.get("damage")?.attrs.getAttribute("type")?.toLowerCase() ?? "";
  const damage = /^\d+d\d+/.test(dice) ? { dice, type: damageType } : undefined;
  const versatile = set.get("versatile")?.text;
  const reach = properties.includes("srd51:property/reach");
  const thrown = properties.includes("srd51:property/thrown");
  const range = set.get("range")?.text.match(/^(\d+)\s*\/\s*(\d+)/);
  const span = range ? { normal: Number(range[1]), long: Number(range[2]) } : undefined;

  addEntry(
    ctx,
    "item",
    name,
    {
      category: "weapon",
      cost: parseCost(set.get("cost")),
      ...(parseWeight(set.get("weight")) !== undefined && {
        weight: parseWeight(set.get("weight")),
      }),
      weapon: {
        category: weaponCategory,
        kind,
        ...(damage && { damage }),
        ...(damage &&
          versatile &&
          /^\d+d\d+/.test(versatile) && {
            twoHandedDamage: { dice: versatile, type: damageType },
          }),
        properties,
        range: kind === "ranged" && span ? span : { normal: reach ? 10 : 5 },
        ...(kind === "melee" && thrown && span && { throwRange: span }),
        proficiency: [`weapon:${weaponCategory}-weapons`],
      },
    },
    { desc: paragraphs(element.querySelector("description")).join("\n\n") },
  );
}

function importArmor(ctx: Context, element: Element, name: string): void {
  const set = setters(element);
  const type = (set.get("armor")?.text ?? set.get("type")?.text ?? "").toLowerCase();
  if (type !== "light" && type !== "medium" && type !== "heavy" && type !== "shield") {
    ctx.result.skipped.Armor = (ctx.result.skipped.Armor ?? 0) + 1;
    return;
  }
  const ac = set.get("armorClass")?.text ?? "";
  const base = number(ac.replace(/^\+/, "")) ?? 10;
  const max = ac.match(/max\s*(\d+)/i)?.[1];
  const strength = number(set.get("strength")?.text ?? "") ?? 0;

  addEntry(
    ctx,
    "item",
    name,
    {
      category: "armor",
      cost: parseCost(set.get("cost")),
      ...(parseWeight(set.get("weight")) !== undefined && {
        weight: parseWeight(set.get("weight")),
      }),
      armor: {
        category: type,
        base,
        dexBonus: /dex/i.test(ac),
        ...(max && { maxDexBonus: Number(max) }),
        strengthMinimum: strength,
        stealthDisadvantage: /disadvantage/i.test(set.get("stealth")?.text ?? ""),
        proficiency: [type === "shield" ? "armor:shields" : `armor:${type}-armor`],
      },
    },
    { desc: paragraphs(element.querySelector("description")).join("\n\n") },
  );
}

function importGear(ctx: Context, element: Element, name: string): void {
  const set = setters(element);
  addEntry(
    ctx,
    "item",
    name,
    {
      category: slugify(set.get("category")?.text ?? "") || "adventuring-gear",
      cost: parseCost(set.get("cost")),
      ...(parseWeight(set.get("weight")) !== undefined && {
        weight: parseWeight(set.get("weight")),
      }),
    },
    { desc: paragraphs(element.querySelector("description")).join("\n\n") },
  );
}

function importLanguage(ctx: Context, element: Element, name: string): void {
  const set = setters(element);
  addEntry(
    ctx,
    "language",
    name,
    {},
    {
      desc: paragraphs(element.querySelector("description")).join("\n\n"),
      speakers: set.get("speakers")?.text,
      script: set.get("script")?.text,
    },
  );
}

const IMPORTERS: Record<string, (ctx: Context, element: Element, name: string) => void> = {
  Spell: importSpell,
  Weapon: importWeapon,
  Armor: importArmor,
  Item: importGear,
  Language: importLanguage,
};

const KIND_OF: Record<string, string> = {
  Spell: "spell",
  Weapon: "item",
  Armor: "item",
  Item: "item",
  Language: "language",
};

/** Reads one or more Aurora XML files into entries and texts for a pack. */
export function parseAurora(files: string[], options: AuroraOptions): AuroraResult {
  const result: AuroraResult = {
    entries: [],
    strings: {},
    sources: [],
    skipped: {},
    duplicates: 0,
    title: "",
  };
  const ctx: Context = { options, result, used: new Set() };
  const sources = new Set<string>();

  for (const text of files) {
    const doc = new DOMParser().parseFromString(text.replace(/^﻿/, ""), "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0)
      throw new AuroraParseError("The file is not valid XML");
    const root = doc.documentElement;
    if (!root || root.tagName !== "elements")
      throw new AuroraParseError("Not an Aurora elements file");
    result.title ||= clean(root.querySelector("info > name")?.textContent);

    for (const element of Array.from(root.getElementsByTagName("element"))) {
      const type = element.getAttribute("type") ?? "";
      const name = clean(element.getAttribute("name"));
      const source = clean(element.getAttribute("source"));
      const importer = IMPORTERS[type];
      if (!importer || !name) {
        if (type) result.skipped[type] = (result.skipped[type] ?? 0) + 1;
        continue;
      }
      if (options.exists?.(KIND_OF[type] ?? "", name)) {
        result.duplicates += 1;
        continue;
      }
      const before = result.entries.length;
      importer(ctx, element, name);
      if (source && result.entries.length > before) sources.add(source);
    }
  }
  result.sources = [...sources].sort();
  return result;
}
