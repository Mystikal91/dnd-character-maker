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
  classes: Raw[];
  subclasses: Raw[];
  levels: Raw[];
  features: Raw[];
  equipment: Raw[];
  weaponProperties: Raw[];
  abilityScores: Raw[];
  skills: Raw[];
  magicSchools: Raw[];
  conditions: Raw[];
  alignments: Raw[];
}
export type ConvertedPack = Record<
  | "species"
  | "subspecies"
  | "trait"
  | "background"
  | "spell"
  | "class"
  | "subclass"
  | "feature"
  | "item"
  | "property"
  | "ability"
  | "skill"
  | "language"
  | "proficiency"
  | "school"
  | "condition"
  | "alignment",
  Converted
>;

const id = (kind: string, slug: string) => `${PACK}:${kind}/${slug}`;
const text = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value.join("\n\n") : value;

/**
 * Drops API `url` fields and display `name`s that sit next to an `index` (names belong in
 * locale files), and camel-cases keys (`damage_type` -> `damageType`).
 */
export function cleanData(value: Raw): Raw {
  if (Array.isArray(value)) return value.map(cleanData);
  if (value && typeof value === "object") {
    const hasIndex = "index" in value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "url" && !(hasIndex && key === "name"))
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
  if (set.option_set_type === "options_array") {
    // A nested `choice` option (e.g. the monk's "one tool or one instrument") is flattened
    // into the outer list; the outer `choose` count still applies.
    return (set.options as Raw[]).flatMap((o) =>
      o.option_type === "choice" ? optionValues(ctx, o.choice.from, map) : [map(o)],
    );
  }
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

const lastSegment = (url: string) => url.split("/").pop() ?? url;

function resolveProficiencyKey(ctx: Context, index: string): string {
  const resolved = ctx.proficiency.get(index);
  if (!resolved) throw new Error(`Unknown proficiency: ${index}`);
  return resolved;
}

const scoreRequirement = (option: Raw) => ({
  ability: option.ability_score.index,
  minimum: option.minimum_score,
});

/**
 * How each SRD 5.1 caster picks spells, from the "Spells Known and Prepared" text of each
 * class. Not in the source database as data, so it is recorded here.
 */
type Preparation =
  | { type: "known" }
  | { type: "prepared"; levelDivisor: number }
  | { type: "spellbook"; initial: number; perLevel: number };

const PREPARATION: Record<string, Preparation> = {
  bard: { type: "known" },
  sorcerer: { type: "known" },
  warlock: { type: "known" },
  ranger: { type: "known" },
  cleric: { type: "prepared", levelDivisor: 1 },
  druid: { type: "prepared", levelDivisor: 1 },
  paladin: { type: "prepared", levelDivisor: 2 },
  wizard: { type: "spellbook", initial: 6, perLevel: 2 },
};

function preparationFor(classIndex: string): Preparation {
  const preparation = PREPARATION[classIndex];
  if (!preparation) throw new Error(`No spell preparation rule for class ${classIndex}`);
  return preparation;
}

function convertClasses(raw: RawSource, ctx: Context): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const c of raw.classes) {
    const effects: Effect[] = (c.proficiencies as Raw[]).map((p) =>
      resolveProficiency(ctx, p.index),
    );
    (c.proficiency_choices as Raw[]).forEach((choice, i) => {
      effects.push({
        type: "choice",
        id: `${c.index}-proficiency-${i + 1}`,
        choose: choice.choose,
        grants: "proficiency",
        from: optionValues(ctx, choice.from, (o) => resolveProficiencyKey(ctx, referenceIndex(o))),
      });
    });

    const casting = c.spellcasting;
    const levels = (raw.levels as Raw[])
      .filter((l) => l.class.index === c.index && !l.subclass)
      .sort((a, b) => a.level - b.level)
      .map((l) => {
        if (l.prof_bonus !== Math.ceil(l.level / 4) + 1)
          throw new Error(`Unexpected proficiency bonus at ${l.index}`);
        const sc = l.spellcasting;
        return {
          level: l.level,
          features: (l.features as Raw[]).map((f) => id("feature", f.index)),
          // Counted from the improvement features: the source's own counter is wrong for rogues.
          abilityScoreImprovements: (raw.levels as Raw[]).filter(
            (o) =>
              o.class.index === c.index &&
              !o.subclass &&
              o.level <= l.level &&
              (o.features as Raw[]).some((f) => /ability-score-improvement/.test(f.index)),
          ).length,
          ...(sc?.cantrips_known !== undefined && { cantripsKnown: sc.cantrips_known }),
          ...(sc?.spells_known !== undefined && { spellsKnown: sc.spells_known }),
          ...(sc && {
            spellSlots: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => sc[`spell_slots_level_${n}`] ?? 0),
          }),
          classSpecific: cleanData(l.class_specific ?? {}),
        };
      });
    if (levels.length !== 20) throw new Error(`${c.index} has ${levels.length} level rows`);

    const multi = c.multi_classing;
    const options = multi.prerequisite_options;
    const equipmentOptions = (c.starting_equipment_options as Raw[]).map((option, i) => {
      const { desc, ...rest } = option;
      strings[`${c.index}.startingEquipment.${i + 1}`] = desc;
      return cleanData(rest);
    });
    (casting?.info as Raw[] | undefined)?.forEach((info, i) => {
      strings[`${c.index}.spellcasting.${i + 1}.name`] = info.name;
      strings[`${c.index}.spellcasting.${i + 1}.desc`] = text(info.desc) ?? "";
    });
    strings[`${c.index}.name`] = c.name;

    entries.push({
      id: id("class", c.index),
      kind: "class",
      effects,
      data: {
        hitDie: c.hit_die,
        ...(casting && {
          spellcasting: {
            ability: casting.spellcasting_ability.index,
            startsAtLevel: casting.level,
            preparation: preparationFor(c.index),
          },
        }),
        multiclassing: {
          prerequisites: ((multi.prerequisites ?? []) as Raw[]).map(scoreRequirement),
          ...(options && {
            prerequisiteOptions: {
              choose: options.choose,
              from: options.from.options.map(scoreRequirement),
            },
          }),
          proficiencies: ((multi.proficiencies ?? []) as Raw[]).map((p) =>
            resolveProficiencyKey(ctx, p.index),
          ),
          proficiencyChoices: ((multi.proficiency_choices ?? []) as Raw[]).map((choice) => ({
            choose: choice.choose,
            from: optionValues(ctx, choice.from, (o) =>
              resolveProficiencyKey(ctx, referenceIndex(o)),
            ),
          })),
        },
        levels,
        startingEquipment: (c.starting_equipment as Raw[]).map((e) => ({
          item: id("item", e.equipment.index),
          quantity: e.quantity,
        })),
        startingEquipmentOptions: equipmentOptions,
      },
    });
  }
  return { entries, strings };
}

function convertSubclasses(raw: RawSource): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const s of raw.subclasses) {
    const levels = (raw.levels as Raw[])
      .filter((l) => l.subclass?.index === s.index)
      .sort((a, b) => a.level - b.level)
      .map((l) => ({
        level: l.level,
        features: (l.features as Raw[]).map((f) => id("feature", f.index)),
        ...(l.subclass_specific && { subclassSpecific: cleanData(l.subclass_specific) }),
      }));
    const spells = ((s.spells ?? []) as Raw[]).map((sp) => {
      const requirement = (sp.prerequisites as Raw[]).find((p) => p.type === "level");
      if (!requirement) throw new Error(`Subclass spell without level in ${s.index}`);
      return {
        spell: id("spell", sp.spell.index),
        classLevel: Number(String(requirement.index).split("-").pop()),
      };
    });
    entries.push({
      id: id("subclass", s.index),
      kind: "subclass",
      parent: id("class", s.class.index),
      effects: [],
      data: { levels, spells },
    });
    strings[`${s.index}.name`] = s.name;
    strings[`${s.index}.flavor`] = s.subclass_flavor;
    strings[`${s.index}.desc`] = text(s.desc) ?? "";
  }
  return { entries, strings };
}

function normalizePrerequisite(p: Raw): Raw {
  if (p.type === "spell") return { type: "spell", spell: id("spell", lastSegment(p.spell)) };
  if (p.type === "feature")
    return { type: "feature", feature: id("feature", lastSegment(p.feature)) };
  if (p.type === "level") return { type: "level", level: p.level };
  throw new Error(`Unknown feature prerequisite: ${p.type}`);
}

function convertFeatures(raw: RawSource): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const f of raw.features) {
    const data: Record<string, unknown> = {
      class: id("class", f.class.index),
      level: f.level,
    };
    if (f.subclass) data.subclass = id("subclass", f.subclass.index);
    if (f.prerequisites.length) data.prerequisites = f.prerequisites.map(normalizePrerequisite);
    if (f.feature_specific) data.featureSpecific = cleanData(f.feature_specific);
    const entry: Entry = { id: id("feature", f.index), kind: "feature", effects: [], data };
    if (f.parent) entry.parent = id("feature", f.parent.index);
    entries.push(entry);
    strings[`${f.index}.name`] = f.name;
    strings[`${f.index}.desc`] = text(f.desc) ?? "";
  }
  return { entries, strings };
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const damage = (d: Raw) => ({ dice: d.damage_dice, type: d.damage_type.index });

/** Proficiency keys (`category:target`) that make a character proficient with a weapon or armor. */
function ownProficiencies(raw: RawSource): Map<string, string> {
  const own = new Map<string, string>();
  for (const p of raw.proficiencies) {
    if (p.type === "Weapons" || p.type === "Armor") own.set(p.reference.index, p.index);
  }
  return own;
}

function convertItems(raw: RawSource): Converted {
  const own = ownProficiencies(raw);
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const e of raw.equipment) {
    const data: Record<string, unknown> = {
      category: e.equipment_category.index,
      cost: { amount: e.cost.quantity, unit: e.cost.unit },
    };
    if (e.weight !== undefined) data.weight = e.weight;

    if (e.equipment_category.index === "weapon") {
      const ownKey = own.get(e.index);
      data.weapon = {
        category: String(e.weapon_category).toLowerCase(),
        kind: String(e.weapon_range).toLowerCase(),
        ...(e.damage && { damage: damage(e.damage) }),
        ...(e.two_handed_damage && { twoHandedDamage: damage(e.two_handed_damage) }),
        properties: ((e.properties ?? []) as Raw[]).map((p) => id("property", p.index)),
        range: cleanData(e.range),
        ...(e.throw_range && { throwRange: cleanData(e.throw_range) }),
        proficiency: [
          ...(ownKey ? [`weapon:${ownKey}`] : []),
          `weapon:${String(e.weapon_category).toLowerCase()}-weapons`,
        ],
      };
    } else if (e.equipment_category.index === "armor") {
      const category = String(e.armor_category).toLowerCase();
      const ownKey = own.get(e.index);
      data.armor = {
        category,
        base: e.armor_class.base,
        dexBonus: e.armor_class.dex_bonus,
        ...(e.armor_class.max_bonus !== undefined && { maxDexBonus: e.armor_class.max_bonus }),
        strengthMinimum: e.str_minimum,
        stealthDisadvantage: e.stealth_disadvantage,
        proficiency: [
          ...(ownKey ? [`armor:${ownKey}`] : []),
          ...(category === "shield" ? [] : [`armor:${category}-armor`, "armor:all-armor"]),
        ],
      };
    } else if (e.equipment_category.index === "adventuring-gear") {
      data.gear = {
        category: e.gear_category.index,
        ...(e.quantity !== undefined && { bundleSize: e.quantity }),
        ...(e.contents && {
          contents: (e.contents as Raw[]).map((c) => ({
            item: id("item", c.item.index),
            quantity: c.quantity,
          })),
        }),
      };
    } else if (e.equipment_category.index === "tools") {
      data.tool = { category: slugify(e.tool_category) };
    } else if (e.equipment_category.index === "mounts-and-vehicles") {
      data.vehicle = {
        category: slugify(e.vehicle_category),
        ...(e.speed && { speed: { amount: e.speed.quantity, unit: e.speed.unit } }),
      };
      if (e.capacity) strings[`${e.index}.capacity`] = e.capacity;
    } else {
      throw new Error(`Unknown equipment category: ${e.equipment_category.index}`);
    }

    entries.push({ id: id("item", e.index), kind: "item", effects: [], data });
    strings[`${e.index}.name`] = e.name;
    if (e.desc) strings[`${e.index}.desc`] = text(e.desc) ?? "";
    if (e.special) strings[`${e.index}.special`] = text(e.special) ?? "";
  }
  return { entries, strings };
}

function convertProperties(raw: RawSource): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const p of raw.weaponProperties) {
    entries.push({ id: id("property", p.index), kind: "property", effects: [], data: {} });
    strings[`${p.index}.name`] = p.name;
    strings[`${p.index}.desc`] = text(p.desc) ?? "";
  }
  return { entries, strings };
}

function convertAbilities(raw: RawSource): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const a of raw.abilityScores) {
    entries.push({ id: id("ability", a.index), kind: "ability", effects: [], data: {} });
    strings[`${a.index}.name`] = a.full_name;
    strings[`${a.index}.abbreviation`] = a.name;
    strings[`${a.index}.desc`] = text(a.desc) ?? "";
  }
  return { entries, strings };
}

function convertSkills(raw: RawSource): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const s of raw.skills) {
    entries.push({
      id: id("skill", s.index),
      kind: "skill",
      effects: [],
      data: { ability: s.ability_score.index },
    });
    strings[`${s.index}.name`] = s.name;
    strings[`${s.index}.desc`] = text(s.desc) ?? "";
  }
  return { entries, strings };
}

function convertLanguages(raw: RawSource): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const l of raw.languages) {
    entries.push({
      id: id("language", l.index),
      kind: "language",
      effects: [],
      data: { type: String(l.type).toLowerCase() },
    });
    strings[`${l.index}.name`] = l.name;
    strings[`${l.index}.speakers`] = (l.typical_speakers as string[]).join(", ");
    if (l.script) strings[`${l.index}.script`] = l.script;
    if (l.desc) strings[`${l.index}.desc`] = text(l.desc) ?? "";
  }
  return { entries, strings };
}

function convertProficiencies(raw: RawSource, ctx: Context): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const p of raw.proficiencies) {
    const [category, target] = (ctx.proficiency.get(p.index) ?? "").split(":");
    entries.push({
      id: id("proficiency", p.index),
      kind: "proficiency",
      effects: [],
      data: { category, target },
    });
    strings[`${p.index}.name`] = p.name;
  }
  return { entries, strings };
}

function convertAlignments(raw: RawSource): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const a of raw.alignments) {
    entries.push({ id: id("alignment", a.index), kind: "alignment", effects: [], data: {} });
    strings[`${a.index}.name`] = a.name;
    strings[`${a.index}.abbreviation`] = a.abbreviation;
    strings[`${a.index}.desc`] = text(a.desc) ?? "";
  }
  return { entries, strings };
}

function convertConditions(raw: RawSource): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const m of raw.conditions) {
    entries.push({ id: id("condition", m.index), kind: "condition", effects: [], data: {} });
    strings[`${m.index}.name`] = m.name;
    strings[`${m.index}.desc`] = text(m.desc) ?? "";
  }
  return { entries, strings };
}

function convertSchools(raw: RawSource): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const m of raw.magicSchools) {
    entries.push({ id: id("school", m.index), kind: "school", effects: [], data: {} });
    strings[`${m.index}.name`] = m.name;
    strings[`${m.index}.desc`] = text(m.desc) ?? "";
  }
  return { entries, strings };
}

export function convertAll(raw: RawSource): ConvertedPack {
  const ctx = buildContext(raw);
  return {
    species: convertSpecies(raw, ctx),
    subspecies: convertSubspecies(raw),
    trait: convertTraits(raw, ctx),
    background: convertBackgrounds(raw, ctx),
    spell: convertSpells(raw),
    class: convertClasses(raw, ctx),
    subclass: convertSubclasses(raw),
    feature: convertFeatures(raw),
    item: convertItems(raw),
    property: convertProperties(raw),
    ability: convertAbilities(raw),
    skill: convertSkills(raw),
    language: convertLanguages(raw),
    proficiency: convertProficiencies(raw, ctx),
    school: convertSchools(raw),
    condition: convertConditions(raw),
    alignment: convertAlignments(raw),
  };
}
