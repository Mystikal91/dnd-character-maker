/**
 * Converts raw 5e-database (2014) JSON into content-pack entries plus English strings.
 * Pure functions: no file or network access, so they can be unit tested.
 */
import type { Ability, Effect, Entry, ProficiencyCategory } from "../../src/data/schema";

const PACK = "srd51";

// biome-ignore lint/suspicious/noExplicitAny: raw third-party JSON, shaped by the source database
type Raw = any;

export type Strings = Record<string, string>;
export interface Converted {
  entries: Entry[];
  strings: Strings;
}
export interface RawSource {
  races: Raw[];
  subraces: Raw[];
  traits: Raw[];
  backgrounds: Raw[];
  spells: Raw[];
  proficiencies: Raw[];
  languages: Raw[];
}
export type ConvertedPack = Record<
  "species" | "subspecies" | "trait" | "background" | "spell",
  Converted
>;

const id = (kind: string, slug: string) => `${PACK}:${kind}/${slug}`;
const text = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value.join("\n\n") : value;

/** Drops API `url` fields and camel-cases keys (`damage_type` -> `damageType`). */
export function cleanData(value: Raw): Raw {
  if (Array.isArray(value)) return value.map(cleanData);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "url")
        .map(([key, v]) => [
          key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
          cleanData(v),
        ]),
    );
  }
  return value;
}

const PROFICIENCY_TYPES: Record<string, ProficiencyCategory> = {
  Skills: "skill",
  "Saving Throws": "save",
  Armor: "armor",
  Weapons: "weapon",
  "Artisan's Tools": "tool",
  "Gaming Sets": "tool",
  "Musical Instruments": "tool",
  Other: "tool",
  Vehicles: "tool",
};

interface Context {
  /** proficiency index -> `category:target` */
  proficiency: Map<string, string>;
  languages: string[];
}

function buildContext(raw: RawSource): Context {
  const proficiency = new Map<string, string>();
  for (const p of raw.proficiencies) {
    const category = PROFICIENCY_TYPES[p.type];
    if (!category) throw new Error(`Unknown proficiency type: ${p.type}`);
    const target = category === "skill" || category === "save" ? p.reference.index : p.index;
    proficiency.set(p.index, `${category}:${target}`);
  }
  return { proficiency, languages: raw.languages.map((l: Raw) => l.index) };
}

function resolveProficiency(ctx: Context, index: string): Effect {
  const resolved = ctx.proficiency.get(index);
  if (!resolved) throw new Error(`Unknown proficiency: ${index}`);
  const [category, target] = resolved.split(":") as [ProficiencyCategory, string];
  return { type: "proficiency", category, target };
}

/** Flattens a 5e-database option set into plain option values. */
function optionValues(ctx: Context, set: Raw, map: (option: Raw) => string): string[] {
  if (set.option_set_type === "options_array") return set.options.map(map);
  if (set.option_set_type === "resource_list") {
    if (set.resource_list_url.endsWith("/languages")) return ctx.languages;
    throw new Error(`Unsupported resource list: ${set.resource_list_url}`);
  }
  throw new Error(`Unsupported option set: ${set.option_set_type}`);
}

const referenceIndex = (option: Raw): string => {
  if (option.option_type !== "reference")
    throw new Error(`Unexpected option: ${option.option_type}`);
  return option.item.index;
};

function languageChoice(ctx: Context, owner: string, options: Raw): Effect {
  return {
    type: "choice",
    id: `${owner}-language`,
    choose: options.choose,
    grants: "language",
    from: optionValues(ctx, options.from, referenceIndex),
  };
}

function abilityBonuses(list: Raw[] | undefined): Effect[] {
  return (list ?? []).map((b) => ({
    type: "abilityBonus",
    ability: b.ability_score.index as Ability,
    value: b.bonus,
  }));
}

function traitRefs(list: Raw[] | undefined): Effect[] {
  return (list ?? []).map((t) => ({ type: "trait", id: id("trait", t.index) }));
}

function convertTraits(raw: RawSource, ctx: Context): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const t of raw.traits) {
    const effects: Effect[] = (t.proficiencies as Raw[]).map((p) =>
      resolveProficiency(ctx, p.index),
    );
    if (t.proficiency_choices) {
      effects.push({
        type: "choice",
        id: `${t.index}-proficiency`,
        choose: t.proficiency_choices.choose,
        grants: "proficiency",
        from: optionValues(ctx, t.proficiency_choices.from, (o) => {
          const resolved = ctx.proficiency.get(referenceIndex(o));
          if (!resolved) throw new Error(`Unknown proficiency: ${referenceIndex(o)}`);
          return resolved;
        }),
      });
    }
    if (t.language_options) effects.push(languageChoice(ctx, t.index, t.language_options));

    const { spell_options, subtrait_options, ...specific } = t.trait_specific ?? {};
    if (spell_options) {
      effects.push({
        type: "choice",
        id: `${t.index}-spell`,
        choose: spell_options.choose,
        grants: "spell",
        from: optionValues(ctx, spell_options.from, (o) => id("spell", referenceIndex(o))),
      });
    }
    if (subtrait_options) {
      effects.push({
        type: "choice",
        id: `${t.index}-subtrait`,
        choose: subtrait_options.choose,
        grants: "trait",
        from: optionValues(ctx, subtrait_options.from, (o) => id("trait", referenceIndex(o))),
      });
    }
    const leftover = cleanData(specific);
    const entry: Entry = {
      id: id("trait", t.index),
      kind: "trait",
      effects,
      data: Object.keys(leftover).length ? { traitSpecific: leftover } : {},
    };
    if (t.parent) entry.parent = id("trait", t.parent.index);
    entries.push(entry);
    strings[`${t.index}.name`] = t.name;
    strings[`${t.index}.desc`] = text(t.desc) ?? "";
  }
  return { entries, strings };
}

function convertSpecies(raw: RawSource, ctx: Context): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const r of raw.races) {
    const effects: Effect[] = abilityBonuses(r.ability_bonuses);
    if (r.ability_bonus_options) {
      const options = r.ability_bonus_options;
      const bonuses = new Set<number>(options.from.options.map((o: Raw) => o.bonus));
      if (bonuses.size !== 1) throw new Error(`Mixed ability bonus values in ${r.index}`);
      effects.push({
        type: "choice",
        id: `${r.index}-ability`,
        choose: options.choose,
        grants: "abilityBonus",
        from: options.from.options.map((o: Raw) => o.ability_score.index),
        value: [...bonuses][0],
      });
    }
    for (const l of r.languages as Raw[]) {
      effects.push({ type: "proficiency", category: "language", target: l.index });
    }
    if (r.language_options) effects.push(languageChoice(ctx, r.index, r.language_options));
    effects.push(...traitRefs(r.traits));

    entries.push({
      id: id("species", r.index),
      kind: "species",
      effects,
      data: { speed: r.speed, size: String(r.size).toLowerCase() },
    });
    strings[`${r.index}.name`] = r.name;
    strings[`${r.index}.age`] = r.age;
    strings[`${r.index}.alignment`] = r.alignment;
    strings[`${r.index}.sizeDescription`] = r.size_description;
    strings[`${r.index}.languageDescription`] = r.language_desc ?? "";
  }
  return { entries, strings };
}

function convertSubspecies(raw: RawSource): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const s of raw.subraces) {
    entries.push({
      id: id("subspecies", s.index),
      kind: "subspecies",
      parent: id("species", s.race.index),
      effects: [...abilityBonuses(s.ability_bonuses), ...traitRefs(s.racial_traits)],
      data: {},
    });
    strings[`${s.index}.name`] = s.name;
    strings[`${s.index}.desc`] = s.desc;
  }
  return { entries, strings };
}

function convertBackgrounds(raw: RawSource, ctx: Context): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const b of raw.backgrounds) {
    const effects: Effect[] = (b.starting_proficiencies as Raw[]).map((p) =>
      resolveProficiency(ctx, p.index),
    );
    if (b.language_options) effects.push(languageChoice(ctx, b.index, b.language_options));

    const choose: Record<string, number> = {};
    strings[`${b.index}.name`] = b.name;
    strings[`${b.index}.featureName`] = b.feature.name;
    strings[`${b.index}.featureDesc`] = text(b.feature.desc) ?? "";
    for (const group of ["personality_traits", "ideals", "bonds", "flaws"] as const) {
      const key = group.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      choose[key] = b[group].choose;
      (b[group].from.options as Raw[]).forEach((option, i) => {
        strings[`${b.index}.${key}.${i + 1}`] = option.string ?? option.desc;
      });
    }
    entries.push({
      id: id("background", b.index),
      kind: "background",
      effects,
      data: {
        choose,
        startingGold: b.starting_gold,
        startingEquipment: (b.starting_equipment as Raw[]).map((e) => ({
          item: id("item", e.equipment.index),
          quantity: e.quantity,
        })),
        startingEquipmentOptions: cleanData(b.starting_equipment_options),
      },
    });
  }
  return { entries, strings };
}

function convertSpells(raw: RawSource): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const s of raw.spells) {
    const data: Record<string, unknown> = {
      level: s.level,
      school: s.school.index,
      components: s.components,
      ritual: s.ritual,
      concentration: s.concentration,
      classes: (s.classes as Raw[]).map((c) => id("class", c.index)),
    };
    for (const key of ["attack_type", "damage", "dc", "heal_at_slot_level", "area_of_effect"]) {
      if (s[key] !== undefined) data[cleanKey(key)] = cleanData(s[key]);
    }
    entries.push({ id: id("spell", s.index), kind: "spell", effects: [], data });
    strings[`${s.index}.name`] = s.name;
    strings[`${s.index}.desc`] = text(s.desc) ?? "";
    if (s.higher_level) strings[`${s.index}.higherLevel`] = text(s.higher_level) ?? "";
    if (s.material) strings[`${s.index}.material`] = s.material;
    strings[`${s.index}.castingTime`] = s.casting_time;
    strings[`${s.index}.range`] = s.range;
    strings[`${s.index}.duration`] = s.duration;
  }
  return { entries, strings };
}

const cleanKey = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export function convertAll(raw: RawSource): ConvertedPack {
  const ctx = buildContext(raw);
  return {
    species: convertSpecies(raw, ctx),
    subspecies: convertSubspecies(raw),
    trait: convertTraits(raw, ctx),
    background: convertBackgrounds(raw, ctx),
    spell: convertSpells(raw),
  };
}
