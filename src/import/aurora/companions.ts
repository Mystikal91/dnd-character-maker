import { emit } from "./emit";
import type { Context, Source } from "./registry";
import { readRules } from "./rules";
import { description, number, setters, slugify } from "./xml";

/**
 * Companions are creatures a character can have (a familiar, a ranger's beast, a steel defender).
 * Aurora writes the stat block as free text in the setters (`13 (natural armor)`, `40 ft., Burrow
 * 5 ft.`) and keeps the traits, actions and reactions as elements of their own, listed by id. What
 * reads as plain numbers becomes data, as for the monsters of the SRD; what is a formula of the
 * level or of the proficiency bonus (`14 + PB`) stays as the text it was written in.
 */

const SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
const ABILITY_OF: Record<string, string> = {
  str: "str",
  strength: "str",
  dex: "dex",
  dexterity: "dex",
  con: "con",
  constitution: "con",
  int: "int",
  intelligence: "int",
  wis: "wis",
  wisdom: "wis",
  cha: "cha",
  charisma: "cha",
};
/** Experience points of each challenge rating, from the rules of the game. */
const XP_OF: Record<string, number> = {
  "0": 10,
  "0.125": 25,
  "0.25": 50,
  "0.5": 100,
  ...Object.fromEntries(
    [
      200, 450, 700, 1100, 1800, 2300, 2900, 3900, 5000, 5900, 7200, 8400, 10000, 11500, 13000,
      15000, 18000, 20000, 22000, 25000, 33000, 41000, 50000, 62000, 75000, 90000, 105000, 120000,
      135000, 155000,
    ].map((xp, i) => [String(i + 1), xp]),
  ),
};

const FORMULA = /\bPB\b|\bplus\b|proficiency|\blevel\b|[×x]\s*\d|\d\s*[×x]\s/i;

/** A value of the stat block: the data it reads as, and whether the text must be kept too. */
export interface Parsed<T> {
  data?: T;
  /** The text says more than the data does (a formula, a note): keep it as written. */
  verbatim: boolean;
}

export function parseArmorClass(
  text: string,
): Parsed<{ type?: string; value: number; plus?: string }[]> {
  const plain = /^(\d+)(?:\s*\(\s*natural armor\s*\))?$/i.exec(text);
  if (plain)
    return {
      data: [{ type: /natural/i.test(text) ? "natural" : "dex", value: Number(plain[1]) }],
      verbatim: false,
    };
  const lead = /^(\d+)/.exec(text);
  if (!lead) return { verbatim: true };
  const modifier = /\+\s*your\s+(\w+)\s+modifier/i.exec(text);
  const plus = /\+\s*(PB|proficiency)/i.test(text)
    ? ("proficiency" as const)
    : modifier
      ? ABILITY_OF[(modifier[1] as string).toLowerCase()]
      : undefined;
  return {
    data: [
      {
        ...(/natural/i.test(text) && { type: "natural" }),
        value: Number(lead[1]),
        ...(plus && { plus }),
      },
    ],
    verbatim: true,
  };
}

const COUNT_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};
const CLASS_WORDS = [
  "artificer",
  "barbarian",
  "bard",
  "cleric",
  "druid",
  "fighter",
  "monk",
  "paladin",
  "ranger",
  "rogue",
  "sorcerer",
  "warlock",
  "wizard",
];
const ABILITY_NAME = "(strength|dexterity|constitution|intelligence|wisdom|charisma)";

/** Hit points that grow with the owner: `5 + five times your ranger level`, plus modifiers. */
export interface HitPointScale {
  base: number;
  perLevel: number;
  /** Abilities of the owner whose modifiers are added. */
  owner: string[];
  /** Abilities of the creature itself whose modifiers are added. */
  own: string[];
  /** The class whose level counts, when the text names it. */
  class?: string;
}

export function parseHitPointScale(text: string): HitPointScale | undefined {
  const lower = text
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/’/g, "'")
    .toLowerCase();
  const times =
    /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+times\s+your\s+(?:(\w+)\s+level|level in this class)/.exec(
      lower,
    );
  const plain = /\+\s*your\s+(\w+)\s+level/.exec(lower);
  let perLevel = 0;
  let cls: string | undefined;
  if (times) {
    perLevel = COUNT_WORDS[times[1] as string] ?? Number(times[1]);
    if (times[2] && CLASS_WORDS.includes(times[2])) cls = times[2];
  } else if (plain && CLASS_WORDS.includes(plain[1] as string)) {
    perLevel = 1;
    cls = plain[1];
  } else return undefined;
  const base = /^\s*(\d+)\s*\+/.exec(lower);
  const abilities = (re: RegExp) =>
    [...lower.matchAll(re)].map((m) => ABILITY_OF[m[1] as string]).filter(Boolean) as string[];
  return {
    base: base ? Number(base[1]) : 0,
    perLevel,
    owner: abilities(new RegExp(`your\\s+${ABILITY_NAME}\\s+modifier`, "g")),
    own: abilities(new RegExp(`[a-z ]+'s\\s+${ABILITY_NAME}\\s+modifier`, "g")),
    ...(cls && { class: cls }),
  };
}

/** A bonus of a creature that adds a multiple of the owner's proficiency bonus (`Dex +1 plus PB`). */
export interface Scaled {
  base: number;
  pb: number;
}

/** `Dex +1 plus PB, Wis +2 plus PB` or `Perception +0 plus PB×2`, by slug. */
export function parseScaledBonuses(text: string, saves: boolean): Record<string, Scaled> {
  const found: Record<string, Scaled> = {};
  for (const m of text.matchAll(
    /([A-Za-z][A-Za-z ]*?)\s*([+-]\s*\d+)\s*(?:plus|\+)\s*\(?\s*PB\s*(?:[×x]\s*(\d+))?\s*\)?/gi,
  )) {
    const name = (m[1] as string).trim();
    const slug = saves ? ABILITY_OF[name.toLowerCase()] : slugify(name);
    if (slug)
      found[slug] = { base: Number((m[2] as string).replace(/\s+/g, "")), pb: Number(m[3] ?? 1) };
  }
  return found;
}

/** `passive Perception 10 plus PB×2` */
export function parseScaledPassive(text: string): Scaled | undefined {
  const m = /passive perception\s*(\d+)\s*(?:plus|\+)\s*\(?\s*PB\s*(?:[×x]\s*(\d+))?\s*\)?/i.exec(
    text,
  );
  return m ? { base: Number(m[1]), pb: Number(m[2] ?? 1) } : undefined;
}

export function parseHitPoints(
  text: string,
): Parsed<{ hitPoints: number; hitDice?: string; hitPointsRoll?: string }> {
  const m = /^(\d+)\s*(?:\(\s*(\d+d\d+)\s*(?:([+-])\s*(\d+))?\s*\))?$/i.exec(text);
  if (!m) return { verbatim: true };
  return {
    data: {
      hitPoints: Number(m[1]),
      ...(m[2] && { hitDice: m[2], hitPointsRoll: `${m[2]}${m[3] ? `${m[3]}${m[4]}` : ""}` }),
    },
    verbatim: false,
  };
}

export function parseSpeed(text: string): Parsed<Record<string, number | true>> {
  const speed: Record<string, number | true> = {};
  let rest = text;
  for (const m of text.matchAll(/(?:\b(walk|burrow|climb|fly|swim)\s+)?(\d+)\s*ft\.?/gi)) {
    speed[(m[1] ?? "walk").toLowerCase()] = Number(m[2]);
    rest = rest.replace(m[0], "");
  }
  if (/\(\s*hover\s*\)/i.test(text) && speed.fly !== undefined) {
    speed.hover = true;
    rest = rest.replace(/\(\s*hover\s*\)/i, "");
  }
  if (Object.keys(speed).length === 0) return { verbatim: true };
  return { data: speed, verbatim: rest.replace(/[\s,.;]+/g, "") !== "" };
}

export function parseSenses(text: string): {
  senses: Record<string, number>;
  blindBeyond: string[];
  passivePerception?: number;
  verbatim: boolean;
} {
  const senses: Record<string, number> = {};
  const blindBeyond: string[] = [];
  let rest = text;
  for (const m of text.matchAll(
    /\b(darkvision|blindsight|tremorsense|truesight)\s*(\d+)\s*ft\.?(\s*\(\s*blind beyond this radius\s*\))?/gi,
  )) {
    const sense = (m[1] as string).toLowerCase();
    senses[sense] = Number(m[2]);
    if (m[3]) blindBeyond.push(sense);
    rest = rest.replace(m[0], "");
  }
  const passive = /passive perception\s*(\d+)(?!\s*(?:\+|plus))/i.exec(text);
  if (passive) rest = rest.replace(passive[0], "");
  return {
    senses,
    blindBeyond,
    ...(passive && { passivePerception: Number(passive[1]) }),
    verbatim: FORMULA.test(text) || rest.replace(/[\s,.;]+/g, "") !== "",
  };
}

/** `Perception +3, Stealth +4` (skills) or `Dex +1, Wis +2` (saving throws), by slug. */
export function parseBonuses(text: string, saves: boolean): Parsed<Record<string, number>> {
  const found: Record<string, number> = {};
  let rest = text;
  for (const m of text.matchAll(/([A-Za-z][A-Za-z ]*?)\s*([+-]\s*\d+)/g)) {
    const name = (m[1] as string).trim();
    const slug = saves ? ABILITY_OF[name.toLowerCase()] : slugify(name);
    if (!slug) continue;
    found[slug] = Number((m[2] as string).replace(/\s+/g, ""));
    rest = rest.replace(m[0], "");
  }
  if (Object.keys(found).length === 0) return { verbatim: true };
  return { data: found, verbatim: FORMULA.test(text) || rest.replace(/[\s,.;]+/g, "") !== "" };
}

export function parseChallenge(text: string): { challenge?: number; xp?: number } {
  const lead = /^(\d+)\s*\/\s*(\d+)|^(\d+)/.exec(text.trim());
  if (!lead) return {};
  const challenge = lead[3] !== undefined ? Number(lead[3]) : Number(lead[1]) / Number(lead[2]);
  const given = /\(\s*([\d,]+)\s*XP\s*\)/i.exec(text);
  const xp = given ? Number(given[1]?.replace(/,/g, "")) : XP_OF[String(challenge)];
  return { challenge, ...(xp !== undefined && { xp }) };
}

/** What an action says in numbers: the bonus to hit, the damage and the save it asks for. */
const DAMAGE_TYPES = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
];

/**
 * What an action of a creature adds, besides its own numbers, from its owner: the proficiency
 * bonus (`pb`), the spell attack modifier (`spell`) and the modifier of an ability (`wis`).
 */
export type Plus = string[];

interface DamagePart {
  type: string;
  dice: string;
  plus?: Plus;
}

function parseDamage(text: string): DamagePart[] {
  const parts: DamagePart[] = [];
  for (const m of text.matchAll(/(\d+d\d+)([^.;]*?)\bdamage\b/gi)) {
    const rest = m[2] as string;
    const at = DAMAGE_TYPES.map((t) => ({
      t,
      i: rest.toLowerCase().search(new RegExp(`\\b${t}\\b`)),
    }))
      .filter((x) => x.i >= 0)
      .sort((a, b) => a.i - b.i)[0];
    if (!at) continue;
    const constant = [...rest.matchAll(/\+\s*(\d+)(?!\s*d)/g)].reduce(
      (n, c) => n + Number(c[1]),
      0,
    );
    const plus: Plus = [];
    if (/(?:\+|plus)\s*(?:your\s+)?(?:PB|proficiency bonus)\b/i.test(rest)) plus.push("pb");
    for (const a of rest.matchAll(
      new RegExp(`(?:\\+|plus)\\s*your\\s+${ABILITY_NAME}\\s+modifier`, "gi"),
    ))
      plus.push(ABILITY_OF[(a[1] as string).toLowerCase()] as string);
    parts.push({
      type: at.t,
      dice: `${m[1]}${constant ? `+${constant}` : ""}`,
      ...(plus.length > 0 && { plus }),
    });
  }
  return parts;
}

export function parseAction(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const hit = /([+-]\d+)\s+(plus\s+(?:your\s+)?(?:PB|proficiency bonus)\s+)?to hit/i.exec(text);
  if (hit) {
    out.attackBonus = Number(hit[1]);
    if (hit[2]) out.attackPlus = ["pb"];
  } else if (
    /your spell attack modifier to hit|bonus equals your spell attack modifier/i.test(text)
  ) {
    out.attackBonus = 0;
    out.attackPlus = ["spell"];
  }
  const damage = parseDamage(text);
  if (damage.length === 0) {
    const flat = /Hit:\s*(\d+)\s+([a-z]+)\s+damage/i.exec(text);
    if (flat) damage.push({ type: (flat[2] as string).toLowerCase(), dice: flat[1] as string });
  }
  if (damage.length > 0) out.damage = damage;
  const save =
    /DC\s*(\d+)\s*(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i.exec(
      text,
    );
  if (save)
    out.dc = { ability: ABILITY_OF[(save[2] as string).toLowerCase()], value: Number(save[1]) };
  return out;
}

const idsOf = (text: string) =>
  text
    .split(/\s*,\s*/)
    .map((id) => id.trim())
    .filter(Boolean);

/** The traits, actions or reactions of a companion: the ids its setter lists, and its grants. */
function linked(ctx: Context, source: Source, type: string, listed: string | undefined): Source[] {
  const aids = [
    ...idsOf(listed ?? ""),
    ...readRules(source.el)
      .filter((r) => r.tag === "grant" && r.type === type)
      .map((r) => r.id),
  ];
  const found: Source[] = [];
  for (const aid of new Set(aids)) {
    const part = ctx.byAid.get(aid);
    if (part && part.type === type) found.push(part);
  }
  return found;
}

export function importCompanion(ctx: Context, source: Source): void {
  const set = setters(source.el);
  const text = (...names: string[]) => names.map((n) => set.get(n)?.text ?? "").find(Boolean) ?? "";
  const data: Record<string, unknown> = {};
  const texts: Record<string, string | undefined> = {};

  const size = text("size").toLowerCase();
  if (SIZES.includes(size)) data.size = size;
  const kind = /^([A-Za-z]+)\s*(?:\((.+)\))?/.exec(text("type"));
  if (kind) {
    data.type = (kind[1] as string).toLowerCase();
    if (kind[2]) data.subtype = slugify(kind[2]);
  }

  const abilities: Record<string, number> = {};
  for (const [key, name] of [
    ["str", "strength"],
    ["dex", "dexterity"],
    ["con", "constitution"],
    ["int", "intelligence"],
    ["wis", "wisdom"],
    ["cha", "charisma"],
  ] as const) {
    const score = number(text(name));
    if (score !== undefined) abilities[key] = score;
  }
  if (Object.keys(abilities).length === 6) data.abilities = abilities;

  const ac = parseArmorClass(text("ac"));
  if (ac.data) data.armorClass = ac.data;
  if (ac.verbatim && text("ac")) texts.armorClass = text("ac");
  const hp = parseHitPoints(text("hp"));
  if (hp.data) Object.assign(data, hp.data);
  if (hp.verbatim && text("hp")) texts.hitPoints = text("hp");
  const speed = parseSpeed(text("speed"));
  if (speed.data) data.speed = speed.data;
  if (speed.verbatim && text("speed")) texts.speed = text("speed");

  const saves = parseBonuses(text("saves"), true);
  if (saves.data) data.saves = saves.data;
  if (saves.verbatim && text("saves")) texts.saves = text("saves");
  const skills = parseBonuses(text("skills"), false);
  if (skills.data) data.skills = skills.data;
  if (skills.verbatim && text("skills")) texts.skills = text("skills");

  const senses = parseSenses(text("senses"));
  if (Object.keys(senses.senses).length > 0) data.senses = senses.senses;
  if (senses.blindBeyond.length > 0) data.blindBeyond = senses.blindBeyond;
  if (senses.passivePerception !== undefined) data.passivePerception = senses.passivePerception;
  if (senses.verbatim && text("senses")) texts.senses = text("senses");

  // What grows with the owner: kept as numbers, to work out once there is an owner to ask.
  const scaling: Record<string, unknown> = {};
  const hitPointScale = parseHitPointScale(text("hp"));
  if (hitPointScale) scaling.hitPoints = hitPointScale;
  const savesScale = parseScaledBonuses(text("saves"), true);
  if (Object.keys(savesScale).length > 0) scaling.saves = savesScale;
  const skillsScale = parseScaledBonuses(text("skills"), false);
  if (Object.keys(skillsScale).length > 0) scaling.skills = skillsScale;
  const passiveScale = parseScaledPassive(text("senses"));
  if (passiveScale) scaling.passivePerception = passiveScale;
  if (Object.keys(scaling).length > 0) data.scaling = scaling;

  const { challenge, xp } = parseChallenge(text("challenge"));
  if (challenge !== undefined) data.challenge = challenge;
  if (xp !== undefined) data.xp = xp;
  const proficiency = number(text("proficiency"));
  if (proficiency !== undefined) data.proficiencyBonus = proficiency;
  else if (challenge !== undefined)
    data.proficiencyBonus = 2 + Math.floor((Math.max(challenge, 1) - 1) / 4);

  const uses = (source.el.querySelector(":scope > supports")?.textContent ?? "")
    .split(/\s*,\s*/)
    .map((t) => slugify(t))
    .filter(Boolean);
  if (uses.length > 0) data.uses = uses;

  texts.alignment = text("alignment");
  const languages = text("languages");
  if (languages && !/^(—|-|–|none)$/i.test(languages)) texts.languages = languages;
  texts.vulnerabilities = text("vulnerabilities");
  texts.resistances = text("resistances", "damage resistances");
  texts.immunities = text("immunities", "damage immunities");
  texts.conditionImmunities = text("conditionImmunities", "condition immunities");
  texts.desc = description(source.el);

  const sections = {
    special: linked(ctx, source, "Companion Trait", set.get("traits")?.text),
    actions: linked(ctx, source, "Companion Action", set.get("actions")?.text),
    reactions: linked(ctx, source, "Companion Reaction", set.get("reactions")?.text),
  };
  for (const [section, parts] of Object.entries(sections)) {
    if (parts.length === 0) continue;
    data[section] = parts.map((part, i) => {
      texts[`${section}.${i + 1}.name`] = part.name;
      texts[`${section}.${i + 1}.desc`] = description(part.el);
      return section === "special" ? {} : parseAction(description(part.el));
    });
  }

  emit(ctx, source, data, texts);
}
