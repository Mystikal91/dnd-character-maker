import { ABILITIES, type Ability, type Effect } from "../../data/schema";
import { evaluateRequirements } from "../../engine/requirements";
import { classIdByName } from "./emit";
import { type Context, FEATURE_TYPES, type Source, elementTags, ofType } from "./registry";
import { clean, number, setters, slugify, supportsOf } from "./xml";

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
 * Commas mean "and", `||` means "or", brackets group, and `!` negates a word or a whole group:
 * `!(A||B)` holds when neither is held.
 */
export function requirementsMet(
  requirements: string,
  holds: ReadonlySet<string> = new Set(),
): boolean {
  return evaluateRequirements(requirements, (word) => holds.has(word));
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
    const target = [x, `${x}-armor`, x.replace(/-armor$/, ""), x.replace(/s$/, ""), `${x}s`].find(
      has,
    );
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

/** The tools a select can ask for by group, as the app names them. */
const TOOL_GROUPS: Record<string, string[]> = {
  "artisan tools": [
    "alchemists-supplies",
    "brewers-supplies",
    "calligraphers-supplies",
    "carpenters-tools",
    "cartographers-tools",
    "cobblers-tools",
    "cooks-utensils",
    "glassblowers-tools",
    "jewelers-tools",
    "leatherworkers-tools",
    "masons-tools",
    "painters-supplies",
    "potters-tools",
    "smiths-tools",
    "tinkers-tools",
    "weavers-tools",
    "woodcarvers-tools",
  ],
  "musical instrument": [
    "bagpipes",
    "drum",
    "dulcimer",
    "flute",
    "lute",
    "lyre",
    "horn",
    "pan-flute",
    "shawm",
    "viol",
  ],
  "gaming set": ["dice-set", "playing-card-set"],
};
TOOL_GROUPS.tool = [
  ...(TOOL_GROUPS["artisan tools"] ?? []),
  ...(TOOL_GROUPS["gaming set"] ?? []),
  ...(TOOL_GROUPS["musical instrument"] ?? []),
  "disguise-kit",
  "forgery-kit",
  "herbalism-kit",
  "navigators-tools",
  "poisoners-kit",
  "thieves-tools",
];

/** "Artisan tools", "Skill||Tool"...: the options when every word names a group of skills or tools. */
function groupedProficiencies(supports: string): string[] | undefined {
  const words = supports.split("||").map((w) => w.trim().toLowerCase());
  if (words.length === 0 || words.some((w) => w !== "skill" && !TOOL_GROUPS[w])) return undefined;
  return [
    ...new Set(
      words.flatMap((w) =>
        w === "skill"
          ? ALL_SKILLS.map((s) => `skill:${s}`)
          : (TOOL_GROUPS[w] ?? []).map((t) => `tool:${t}`),
      ),
    ),
  ];
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

const SCHOOLS = new Set([
  "abjuration",
  "conjuration",
  "divination",
  "enchantment",
  "evocation",
  "illusion",
  "necromancy",
  "transmutation",
]);

interface SpellFacts {
  id: string;
  level: number;
  school: string;
  ritual: boolean;
  classes: Set<string>;
}

const factsCache = new WeakMap<Context, SpellFacts[]>();

/** Every spell the app has and every spell this pack creates, with what a select can ask about. */
function allSpells(ctx: Context): SpellFacts[] {
  const cached = factsCache.get(ctx);
  if (cached) return cached;
  const found: SpellFacts[] = [];
  for (const entry of ctx.options.index.values()) {
    if (entry.kind !== "spell") continue;
    found.push({
      id: entry.id,
      level: Number(entry.data.level ?? 0),
      school: String(entry.data.school ?? ""),
      ritual: entry.data.ritual === true,
      classes: new Set((entry.data.classes as string[] | undefined) ?? []),
    });
  }
  for (const source of ofType(ctx, "Spell")) {
    if (!source.id || source.existing) continue;
    const set = setters(source.el);
    found.push({
      id: source.id,
      level: number(set.get("level")?.text ?? "") ?? 0,
      school: slugify(set.get("school")?.text ?? ""),
      ritual: set.get("isRitual")?.text === "true",
      classes: new Set(
        supportsOf(source.el)
          .map((name) => classIdByName(ctx, name))
          .filter((id): id is string => Boolean(id)),
      ),
    });
  }
  factsCache.set(ctx, found);
  return found;
}

/** Splits at commas that are not inside brackets. */
function splitTop(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (depth === 0 && text.startsWith(separator, i)) {
      parts.push(text.slice(from, i));
      from = i + separator.length;
      i += separator.length - 1;
    }
  }
  parts.push(text.slice(from));
  return parts.map((p) => p.trim()).filter(Boolean);
}

const unwrap = (text: string) => {
  let t = text.trim();
  while (t.startsWith("(") && t.endsWith(")") && splitTop(t.slice(1, -1), "||").length >= 1) {
    const inner = t.slice(1, -1);
    // Only strip brackets that wrap the whole text.
    let depth = 0;
    let whole = true;
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === "(") depth++;
      else if (inner[i] === ")" && --depth < 0) whole = false;
    }
    if (!whole) break;
    t = inner.trim();
  }
  return t;
};

/**
 * The spells a select offers, from its `supports`: spell levels, classes, schools and "Ritual"
 * joined by commas (all must hold) with `||` between alternatives, or a plain list of spells.
 * Returns undefined for what cannot be worked out here (slot levels that depend on the class).
 */
function spellChoices(ctx: Context, supports: string, className: string): string[] | undefined {
  const text = supports.replace(/\$\(spellcasting:list\)/g, className).trim();
  if (!text || text.includes("$(")) return undefined;
  if (/^ID_[A-Z0-9_]+(\s*[|,]\s*ID_[A-Z0-9_]+)*$/.test(text)) {
    const ids = text
      .split(/\s*[|,]\s*/)
      .map((aid) => ctx.byAid.get(aid)?.id)
      .filter((id): id is string => Boolean(id));
    return ids.length > 0 ? ids : undefined;
  }
  const tests: ((s: SpellFacts) => boolean)[] = [];
  for (const part of splitTop(text, ",")) {
    const alternatives: ((s: SpellFacts) => boolean)[] = [];
    for (const raw of splitTop(unwrap(part), "||")) {
      const token = unwrap(raw);
      const lower = token.toLowerCase();
      const classId = classIdByName(ctx, token);
      if (/^\d+$/.test(token)) alternatives.push((s) => s.level === Number(token));
      else if (lower === "ritual") alternatives.push((s) => s.ritual);
      else if (SCHOOLS.has(lower)) alternatives.push((s) => s.school === lower);
      else if (classId) alternatives.push((s) => s.classes.has(classId));
      else return undefined;
    }
    if (alternatives.length === 0) return undefined;
    tests.push((s) => alternatives.some((test) => test(s)));
  }
  const found = allSpells(ctx)
    .filter((s) => tests.every((test) => test(s)))
    .map((s) => s.id);
  return found.length > 0 ? found : undefined;
}

/**
 * The stats of a magic item that the sheet can apply: armor class, saving throws, initiative,
 * speed and an ability score that is raised to a value. Returns false for the rest.
 */
function itemStat(name: string, value: number, mapped: MappedRules, saves: Map<string, number>) {
  const key = name.toLowerCase();
  const modifier = (
    target: "ac" | "initiative" | "speed",
    when?: "wearingArmor" | "wearingShield",
  ) => mapped.effects.push({ type: "modifier", target, value, ...(when && { when }) });
  if (key === "ac:misc") modifier("ac");
  else if (key === "ac:armored:enhancement") modifier("ac", "wearingArmor");
  else if (key === "ac:shield") modifier("ac", "wearingShield");
  else if (key === "initiative") modifier("initiative");
  else if (key === "speed:misc") modifier("speed");
  else {
    const save = key.match(/^([a-z]+):save:misc$/);
    const floor = key.match(/^([a-z]+):score:set$/);
    const saveAbility = save?.[1] ? abilityFromWord(save[1]) : undefined;
    const floorAbility = floor?.[1] ? abilityFromWord(floor[1]) : undefined;
    if (saveAbility) saves.set(saveAbility, value);
    else if (floorAbility)
      mapped.effects.push({ type: "abilityFloor", ability: floorAbility, value });
    else return false;
  }
  return true;
}

/**
 * Features that make a weapon use another ability. Aurora does not say it in a way a program can
 * read, so these few are listed by id; others are reported by users.
 */
const WEAPON_ABILITIES: Record<string, Effect> = {
  ID_WOTC_XGTE_ARCHETYPE_FEATURE_HEXBLADE_HEX_WARRIOR: {
    type: "weaponAbility",
    ability: "cha",
    when: "oneHanded",
    proficient: true,
  },
  ID_WOTC_ERLW_ARCHETYPE_FEATURE_BATTLE_SMITH_BATTLE_READY: {
    type: "weaponAbility",
    ability: "int",
    when: "magic",
  },
};

export interface MappedRules {
  effects: Effect[];
  /** Granted elements, with the class level they come at (undefined: right away). */
  grants: { source: Source; level: number | undefined; requires?: string }[];
  /** Selects that offer elements (features, traits, archetypes), with the options they offer. */
  offers: { rule: Rule; options: Source[] }[];
  speed?: number | undefined;
  size?: string | undefined;
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
  /** The element is a magic item: its stats (armor class, saves...) are read as bonuses. */
  item?: boolean;
  /**
   * Keep the rules whose requirement is not met right now, wrapped in a `when` that the sheet
   * checks each time (a rule that says "unless you have a sub-race"), and set the flags that
   * `Grants` rules name. Without it a rule whose requirement fails is left out.
   */
  live?: boolean;
  idPrefix: string;
}

/**
 * How an Aurora id is known to a `when`: an element is held by the id it has here, anything
 * else (a flag only some `Grants` rule sets) by its own name.
 */
export const heldName = (ctx: Context, aid: string): string => ctx.byAid.get(aid)?.id ?? aid;

/** A requirement with its words renamed to what the app holds. */
export function translateRequirement(ctx: Context, requirements: string): string {
  return requirements.replace(/[A-Za-z][A-Za-z0-9_]*/g, (word) =>
    word.startsWith("ID_") ? heldName(ctx, word) : word,
  );
}

/** Turns an element's rules into the app's effects, and lists what it grants or offers. */
export function mapRules(ctx: Context, source: Source, options: MapOptions): MappedRules {
  const mapped: MappedRules = { effects: [], grants: [], offers: [], unsupported: 0 };
  let choiceCount = 0;
  const saves = new Map<string, number>();
  const nextChoiceId = () => `${options.idPrefix}-${++choiceCount}`;

  const mapRule = (rule: Rule): void => {
    if (rule.tag === "stat") {
      const ability = abilityFromWord(rule.name);
      const value = Number.parseInt(rule.value, 10);
      if (options.item && Number.isFinite(value) && itemStat(rule.name, value, mapped, saves))
        return;
      if (ability && Number.isFinite(value) && !rule.attrs.hasAttribute("level")) {
        mapped.effects.push({ type: "abilityBonus", ability, value });
      } else if (rule.name === "innate speed" && Number.isFinite(value)) {
        mapped.speed = value;
      } else {
        mapped.unsupported += 1;
      }
      return;
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
      } else if (rule.type === "Dragonmark") {
        // A mark sets the flags that its own rules name, which the race tests for.
        const mark = ctx.byAid.get(rule.id);
        if (mark && options.live)
          for (const flag of readRules(mark.el))
            if (flag.tag === "grant" && flag.type === "Grants")
              mapped.effects.push({ type: "flag", id: heldName(ctx, flag.id) });
      } else if (rule.type === "Condition") {
        const m = rule.id.match(
          /^ID_INTERNAL_CONDITION_DAMAGE_(RESISTANCE|IMMUNITY|VULNERABILITY|VULNERAILITY)_([A-Z_]+)$/,
        );
        if (m?.[1] && m[2])
          mapped.effects.push({
            type: "defense",
            kind:
              m[1] === "RESISTANCE"
                ? "resistance"
                : m[1] === "IMMUNITY"
                  ? "immunity"
                  : "vulnerability",
            damage: slugify(m[2].replace(/_/g, " ")),
          });
        else mapped.unsupported += 1;
      } else if (rule.type === "Feat") {
        // A feat that comes with the race, background or class.
        const feat = ctx.byAid.get(rule.id)?.id;
        if (feat) mapped.effects.push({ type: "trait", id: feat });
        else mapped.unsupported += 1;
      } else if (FEATURE_TYPES.has(rule.type)) {
        const target = ctx.byAid.get(rule.id);
        if (target) mapped.grants.push({ source: target, level: rule.level });
      } else if (rule.type === "Grants") {
        if (options.live) mapped.effects.push({ type: "flag", id: heldName(ctx, rule.id) });
      } else {
        mapped.unsupported += 1;
      }
      return;
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
          : (groupedProficiencies(rule.supports) ??
            (/skill/i.test(rule.supports) ? ALL_SKILLS.map((s) => `skill:${s}`) : []));
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
      const from =
        spellChoices(ctx, rule.supports, (options.classSlug ?? "").replace(/-/g, " ")) ?? [];
      if (from.length > 0 && rule.level === undefined)
        mapped.effects.push({
          type: "choice",
          id: nextChoiceId(),
          choose: rule.number,
          grants: "spell",
          from,
        });
      else if (rule.level === undefined) mapped.unsupported += 1;
    } else if (rule.type === "Feat" && !rule.optional) {
      // "One feat of your choice": every feat, or the ones the select asks for.
      const listed = rule.supports
        ? ofType(ctx, "Feat")
            .filter((s) => s.id && selectMatches(rule.supports, s))
            .map((s) => s.id as string)
        : [];
      if (!rule.supports || listed.length > 0)
        mapped.effects.push({
          type: "choice",
          id: nextChoiceId(),
          choose: rule.number,
          grants: "feat",
          from: listed,
        });
      else mapped.unsupported += 1;
    } else if (rule.type === "Ability Score Improvement") {
      const abilities = [...rule.supports.matchAll(/ASI_([A-Z]+)/g)]
        .map((m) => abilityFromWord(m[1] ?? ""))
        .filter((a): a is Ability => Boolean(a));
      // Tasha's customised origins: "one ability score of your choice increases by 2".
      const custom = rule.supports.match(/Custom Ability Score Increase\s*(\d+)/i);
      if (abilities.length > 0 || custom)
        mapped.effects.push({
          type: "choice",
          id: nextChoiceId(),
          choose: rule.number,
          grants: "abilityBonus",
          from: abilities.length > 0 ? abilities : [...ABILITIES],
          value: custom ? Number(custom[1]) : 1,
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
  };

  for (const rule of readRules(source.el)) {
    const met = requirementsMet(rule.requirements, options.holds);
    if (!met && !options.live) continue;
    if (options.skipLevelled && rule.level !== undefined) continue;
    const gated = options.live && rule.requirements.trim() !== "";
    const effectsFrom = mapped.effects.length;
    const grantsFrom = mapped.grants.length;
    const [speed, size] = [mapped.speed, mapped.size];
    mapRule(rule);
    if (!gated) continue;
    if (!met) {
      // Speed and size are plain numbers of the entry: a rule that fails for now does not set them.
      mapped.speed = speed;
      mapped.size = size;
    }
    // The rule holds only while its requirement does, which is checked with the sheet.
    const requires = translateRequirement(ctx, rule.requirements);
    const inner = mapped.effects.splice(effectsFrom);
    const before = mapped.effects[effectsFrom - 1];
    if (inner.length === 0) {
      // nothing to wrap
    } else if (before?.type === "when" && before.requires === requires) {
      before.effects.push(...inner); // one `when` for the rules in a row that ask the same
    } else mapped.effects.push({ type: "when", requires, effects: inner });
    for (const grant of mapped.grants.slice(grantsFrom)) grant.requires = requires;
  }
  // Aurora only describes these in words (or in a stat that feeds the text), so they are known by id.
  const weaponAbility = WEAPON_ABILITIES[source.aid];
  if (weaponAbility) mapped.effects.push(weaponAbility);
  // The same bonus to all six saving throws is one bonus to saving throws.
  const first = [...saves.values()][0];
  if (saves.size === 6 && [...saves.values()].every((v) => v === first) && first !== undefined)
    mapped.effects.push({ type: "modifier", target: "save", value: first });
  else mapped.unsupported += saves.size;
  ctx.result.unsupportedRules += mapped.unsupported;
  return mapped;
}
