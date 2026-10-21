import { ABILITIES, type Ability, type Effect } from "../../data/schema";
import { type Context, FEATURE_TYPES, type Source, elementTags, ofType } from "./registry";
import { clean, slugify } from "./xml";

/** The `<rules>` of an element, as plain data. */
export interface Rule {
  tag: "grant" | "select" | "stat";
  type: string;
  id: string;
  name: string;
  supports: string;
  number: number;
  level: number | undefined;
  value: string;
  requirements: string;
  optional: boolean;
  /** `<item>` children of a list select (personality traits and the like). */
  items: string[];
  attrs: Element;
}

export function readRules(el: Element): Rule[] {
  const rules = el.querySelector(":scope > rules");
  if (!rules) return [];
  return Array.from(rules.children)
    .filter((c) => c.tagName === "grant" || c.tagName === "select" || c.tagName === "stat")
    .map((c) => ({
      tag: c.tagName as Rule["tag"],
      type: c.getAttribute("type") ?? "",
      id: c.getAttribute("id") ?? "",
      name: c.getAttribute("name") ?? "",
      supports: c.getAttribute("supports") ?? "",
      number: Number.parseInt(c.getAttribute("number") ?? "1", 10) || 1,
      level: c.hasAttribute("level")
        ? Number.parseInt(c.getAttribute("level") ?? "", 10)
        : undefined,
      value: c.getAttribute("value") ?? "",
      requirements: c.getAttribute("requirements") ?? "",
      optional: c.getAttribute("optional") === "true",
      items: Array.from(c.querySelectorAll("item")).map((i) => clean(i.textContent)),
      attrs: c,
    }));
}

/**
 * Whether a rule applies in the plain case: nothing optional is chosen. A requirement written as
 * `!SOMETHING` holds, a bare `SOMETHING` does not, unless it is one of the ids in `holds`.
 */
export function requirementsMet(
  requirements: string,
  holds: ReadonlySet<string> = new Set(),
): boolean {
  const text = requirements.trim();
  if (!text) return true;
  // Several alternatives: any group that holds is enough. Commas inside a group all must hold.
  return text.split("||").some((group) =>
    group
      .replace(/[()]/g, "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .every((token) => {
        if (token.startsWith("!")) return !holds.has(token.slice(1));
        return holds.has(token);
      }),
  );
}

const ABILITY_BY_NAME: Record<string, Ability> = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

export const abilityFromWord = (word: string): Ability | undefined =>
  ABILITY_BY_NAME[word.toLowerCase()] ?? ABILITIES.find((a) => a === word.toLowerCase());

/** `selectMatches("Fighting Style, Fighter", option)`: does an option fit what a select offers? */
export function selectMatches(expression: string, option: Source): boolean {
  const tags = elementTags(option).map((t) => t.toLowerCase());
  const parts = expression
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;
  const has = (alt: string) => alt === option.aid.toLowerCase() || tags.includes(alt);
  return parts.every((part) => {
    // `!TCOE Base` asks for options that do not carry the tag.
    if (part.startsWith("!")) return !has(part.slice(1).trim().toLowerCase());
    return part
      .split(/\|\|?/)
      .map((alt) => alt.trim().toLowerCase())
      .some(has);
  });
}

/** The words after the last underscore-separated prefix: `ID_LANGUAGE_COMMON` gives `common`. */
const tail = (id: string, prefix: string): string =>
  slugify(id.replace(prefix, "").replace(/_/g, " "));

/** The proficiency (`category`, `target`) an Aurora proficiency id stands for, if the app knows it. */
export function proficiencyOf(
  ctx: Context,
  aid: string,
): { category: "skill" | "save" | "weapon" | "armor" | "tool"; target: string } | undefined {
  const has = (slug: string) => ctx.options.index.has(`srd51:proficiency/${slug}`);

  let m = aid.match(/^ID_PROFICIENCY_SKILL_(.+)$/);
  if (m?.[1]) return { category: "skill", target: slugify(m[1].replace(/_/g, " ")) };

  m =
    aid.match(/^ID_PROFICIENCY_SAVINGTHROW_(.+)$/) ??
    aid.match(/^ID_PROFICIENCY_SAVING_THROW_(.+)$/);
  if (m?.[1]) {
    const ability = abilityFromWord(m[1]);
    return ability ? { category: "save", target: ability } : undefined;
  }

  m = aid.match(/^ID_PROFICIENCY_ARMOR_PROFICIENCY_(.+)$/);
  if (m?.[1]) {
    const x = slugify(m[1].replace(/_/g, " "));
    const target = [x, `${x}-armor`, x.replace(/-armor$/, ""), x.replace(/s$/, "")].find(has);
    return target ? { category: "armor", target } : undefined;
  }

  m = aid.match(/^ID_PROFICIENCY_WEAPON_PROFICIENCY_(.+)$/);
  if (m?.[1]) {
    const x = slugify(m[1].replace(/_/g, " "));
    // Aurora writes `CROSSBOW_HAND`, the app has `hand-crossbows`; and `crossbows-light`.
    const words = x.split("-");
    const target = [
      x,
      `${x}s`,
      `${x}-weapons`,
      x.replace(/-weapon$/, "s"),
      `${[...words].reverse().join("-")}s`,
      [`${words[0]}s`, ...words.slice(1)].join("-"),
    ].find(has);
    return target ? { category: "weapon", target } : undefined;
  }

  m =
    aid.match(/^ID_PROFICIENCY_TOOL_PROFICIENCY_(.+)$/) ??
    aid.match(/^ID_PROFICIENCY_(?:ARTISAN|GAMING|INSTRUMENT)[A-Z_]*?_(.+)$/);
  if (m?.[1]) {
    const x = slugify(m[1].replace(/_/g, " "));
    const target = [x, `${x}-tools`, `${x}s-tools`, `${x}-supplies`].find(has) ?? x;
    return { category: "tool", target };
  }
  return undefined;
}

/** The ids of every language the app or the pack offers, as proficiency slugs. */
function allLanguages(ctx: Context): string[] {
  const slugs = new Set<string>();
  for (const id of ctx.options.index.keys()) {
    const m = id.match(/^srd\d+:language\/(.+)$/);
    if (m?.[1]) slugs.add(m[1]);
  }
  for (const source of ofType(ctx, "Language")) {
    if (source.id && !source.existing) slugs.add(slugify(source.name));
  }
  return [...slugs];
}

const ALL_SKILLS = [
  "acrobatics",
  "animal-handling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleight-of-hand",
  "stealth",
  "survival",
];

/** Spells of one class and level in the app and in this pack, for "choose a wizard cantrip". */
function spellsFor(ctx: Context, classSlug: string, level: number): string[] {
  const classId = `srd51:class/${classSlug}`;
  const found: string[] = [];
  for (const entry of ctx.options.index.values()) {
    if (entry.kind !== "spell" || entry.data.level !== level) continue;
    if ((entry.data.classes as string[] | undefined)?.includes(classId)) found.push(entry.id);
  }
  return found;
}

export interface MappedRules {
  effects: Effect[];
  /** Granted elements, with the class level they come at (undefined: right away). */
  grants: { source: Source; level: number | undefined }[];
  /** Selects that offer elements (features, traits, archetypes), with the options they offer. */
  offers: { rule: Rule; options: Source[] }[];
  speed?: number;
  size?: string;
  /** Rules that were read but that the app cannot apply. */
  unsupported: number;
}

interface MapOptions {
  /** Ids that count as held when checking requirements (e.g. the class is the starting one). */
  holds?: ReadonlySet<string>;
  /** Skip the rules that depend on a level: the class importer reads those itself. */
  skipLevelled?: boolean;
  /** The class being described, so `$(spellcasting:list)` knows which list to use. */
  classSlug?: string;
  idPrefix: string;
}

/** Turns an element's rules into the app's effects, and lists what it grants or offers. */
export function mapRules(ctx: Context, source: Source, options: MapOptions): MappedRules {
  const mapped: MappedRules = { effects: [], grants: [], offers: [], unsupported: 0 };
  let choiceCount = 0;
  const nextChoiceId = () => `${options.idPrefix}-${++choiceCount}`;

  for (const rule of readRules(source.el)) {
    if (!requirementsMet(rule.requirements, options.holds)) continue;
    if (options.skipLevelled && rule.level !== undefined) continue;

    if (rule.tag === "stat") {
      const ability = abilityFromWord(rule.name);
      const value = Number.parseInt(rule.value, 10);
      if (ability && Number.isFinite(value) && !rule.attrs.hasAttribute("level")) {
        mapped.effects.push({ type: "abilityBonus", ability, value });
      } else if (rule.name === "innate speed" && Number.isFinite(value)) {
        mapped.speed = value;
      } else {
        mapped.unsupported += 1;
      }
      continue;
    }

    if (rule.tag === "grant") {
      if (rule.type === "Proficiency") {
        const p = proficiencyOf(ctx, rule.id);
        if (p) mapped.effects.push({ type: "proficiency", ...p });
        else mapped.unsupported += 1;
      } else if (rule.type === "Language") {
        const slug = tail(rule.id, "ID_LANGUAGE_");
        if (slug) mapped.effects.push({ type: "proficiency", category: "language", target: slug });
      } else if (rule.type === "Size") {
        mapped.size = tail(rule.id, "ID_SIZE_");
      } else if (rule.type === "Vision") {
        const trait = `srd51:trait/${tail(rule.id, "ID_VISION_")}`;
        if (ctx.options.index.has(trait)) mapped.effects.push({ type: "trait", id: trait });
        else mapped.unsupported += 1;
      } else if (rule.type === "Spell") {
        const spell = ctx.byAid.get(rule.id)?.id;
        if (spell) mapped.effects.push({ type: "grantSpell", spell });
        else mapped.unsupported += 1;
      } else if (FEATURE_TYPES.has(rule.type)) {
        const target = ctx.byAid.get(rule.id);
        if (target) mapped.grants.push({ source: target, level: rule.level });
      } else if (rule.type !== "Grants") {
        mapped.unsupported += 1;
      }
      continue;
    }

    // select
    if (rule.type === "Language") {
      mapped.effects.push({
        type: "choice",
        id: nextChoiceId(),
        choose: rule.number,
        grants: "language",
        from: allLanguages(ctx),
      });
    } else if (rule.type === "Proficiency") {
      const listed = rule.supports.split(/\s*[,|]+\s*/).filter((t) => t.startsWith("ID_"));
      const from =
        listed.length > 0
          ? listed
              .map((aid) => proficiencyOf(ctx, aid))
              .filter((p): p is NonNullable<typeof p> => Boolean(p))
              .map((p) => `${p.category}:${p.target}`)
          : /skill/i.test(rule.supports)
            ? ALL_SKILLS.map((s) => `skill:${s}`)
            : [];
      if (from.length > 0)
        mapped.effects.push({
          type: "choice",
          id: nextChoiceId(),
          choose: rule.number,
          grants: "proficiency",
          from,
        });
      else mapped.unsupported += 1;
    } else if (rule.type === "Spell") {
      const text = rule.supports.replace("$(spellcasting:list)", options.classSlug ?? "");
      const wanted = text.match(/^([A-Za-z' ]+?)\s*(?:&&|,)\s*(\d+)$/);
      const classSlug = slugify(wanted?.[1] ?? "");
      const from = wanted ? spellsFor(ctx, classSlug, Number(wanted[2])) : [];
      if (from.length > 0 && rule.level === undefined)
        mapped.effects.push({
          type: "choice",
          id: nextChoiceId(),
          choose: rule.number,
          grants: "spell",
          from,
        });
      else if (rule.level === undefined) mapped.unsupported += 1;
    } else if (rule.type === "Ability Score Improvement") {
      const abilities = [...rule.supports.matchAll(/ASI_([A-Z]+)/g)]
        .map((m) => abilityFromWord(m[1] ?? ""))
        .filter((a): a is Ability => Boolean(a));
      if (abilities.length > 0)
        mapped.effects.push({
          type: "choice",
          id: nextChoiceId(),
          choose: rule.number,
          grants: "abilityBonus",
          from: abilities,
          value: 1,
        });
      else mapped.unsupported += 1;
    } else if (
      FEATURE_TYPES.has(rule.type) ||
      rule.type === "Archetype" ||
      rule.type === "Sub Race"
    ) {
      const list = ofType(ctx, rule.type).filter((s) => selectMatches(rule.supports, s));
      mapped.offers.push({ rule, options: list });
    } else if (rule.type === "List") {
      // Personality tables of a background: read by the background importer.
    } else if (!rule.optional) {
      mapped.unsupported += 1;
    }
  }
  ctx.result.unsupportedRules += mapped.unsupported;
  return mapped;
}
