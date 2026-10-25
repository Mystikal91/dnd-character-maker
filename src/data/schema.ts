import * as v from "valibot";

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export const AbilitySchema = v.picklist(ABILITIES);
export type Ability = v.InferOutput<typeof AbilitySchema>;

/**
 * Namespaced id: `pack:kind/slug`, e.g. `srd51:subspecies/high-elf`.
 * The kind is part of the id because slugs repeat across kinds (a trait and a spell
 * can both be `darkvision`). Texts live in locale files, keyed by this id.
 */
export const EntryIdSchema = v.pipe(
  v.string(),
  v.regex(
    /^[a-z0-9]+:[a-z]+\/[a-z0-9]+(-+[a-z0-9]+)*$/,
    "Expected an id like `pack:kind/entry-name`",
  ),
);

export const PROFICIENCY_CATEGORIES = [
  "skill",
  "save",
  "weapon",
  "armor",
  "tool",
  "language",
] as const;
export const ProficiencyCategorySchema = v.picklist(PROFICIENCY_CATEGORIES);
export type ProficiencyCategory = v.InferOutput<typeof ProficiencyCategorySchema>;

/** What a `modifier` effect changes. */
export const MODIFIER_TARGETS = [
  "ac",
  "speed",
  "initiative",
  "attack",
  "damage",
  "hpPerLevel",
  "save",
] as const;
export type ModifierTarget = (typeof MODIFIER_TARGETS)[number];

/**
 * When a `modifier` applies, for what the character wears or wields:
 * `wearingArmor` (body armor, not a shield), `unarmored` (no body armor), `noHeavyArmor`,
 * `unarmoredNoShield` (neither armor nor a shield),
 * `wearingShield`, `ranged` and `melee` (the weapon of an attack), and `dueling` (a melee weapon that is not
 * two-handed, with no other weapon).
 */
export const MODIFIER_CONDITIONS = [
  "wearingArmor",
  "unarmored",
  "noHeavyArmor",
  "unarmoredNoShield",
  "wearingShield",
  "ranged",
  "melee",
  "dueling",
] as const;
export type ModifierCondition = (typeof MODIFIER_CONDITIONS)[number];

/**
 * Closed set of declarative effects. Extend deliberately, one type at a time.
 * Features that need custom logic are expressed as `trait` (+ optional `resource`)
 * and are not automated.
 */
const PlainEffectSchema = v.variant("type", [
  /**
   * A name other rules can ask for (`when.requires`), for a rule that says "this is held" without
   * being an entry of its own. Entries themselves are held by their id.
   */
  v.object({ type: v.literal("flag"), id: v.string() }),
  v.object({
    type: v.literal("abilityBonus"),
    ability: AbilitySchema,
    value: v.number(),
  }),
  v.object({
    type: v.literal("proficiency"),
    category: ProficiencyCategorySchema,
    target: v.string(),
  }),
  v.object({
    type: v.literal("trait"),
    id: EntryIdSchema,
  }),
  v.object({
    type: v.literal("choice"),
    id: v.string(),
    choose: v.pipe(v.number(), v.integer(), v.minValue(1)),
    /** What each pick grants. `from` holds the options: entry ids, `category:target` for
     * proficiencies, language slugs for languages, ability ids for ability bonuses. A `feat`
     * choice with an empty `from` offers every feat there is. */
    grants: v.picklist([
      "proficiency",
      "language",
      "spell",
      "trait",
      "abilityBonus",
      "expertise",
      "feat",
    ]),
    from: v.array(v.string()),
    /** Bonus applied per pick when `grants` is `abilityBonus`. */
    value: v.optional(v.number()),
    /**
     * A key of the class table (`classSpecific`): the number of picks is that value at the
     * class level, and `choose` is only a placeholder. Invocations and metamagic grow this way.
     */
    chooseBy: v.optional(v.string()),
  }),
  v.object({
    type: v.literal("grantSpell"),
    spell: EntryIdSchema,
    /** The spell comes with this level of the class that gives it (always prepared). */
    minLevel: v.optional(v.number()),
  }),
  /** A flat bonus to a number of the sheet, with an optional condition. */
  v.object({
    type: v.literal("modifier"),
    target: v.picklist(MODIFIER_TARGETS),
    value: v.number(),
    when: v.optional(v.picklist(MODIFIER_CONDITIONS)),
    /** Applies from this level of the class that gives it (of the whole character, for a species). */
    minLevel: v.optional(v.number()),
  }),
  /** Double proficiency bonus on a skill the character is proficient in. */
  v.object({ type: v.literal("expertise"), skill: v.string() }),
  /** The ability score is at least this high (Gauntlets of Ogre Power): it never lowers it. */
  v.object({ type: v.literal("abilityFloor"), ability: AbilitySchema, value: v.number() }),
  /**
   * Attacks with weapons may use this ability instead of Strength or Dexterity (Hex Warrior,
   * Battle Ready). The attack takes the best ability that applies. `when` narrows the weapons:
   * `oneHanded` (without the two-handed property) or `magic` (a magic item). `proficient` asks
   * for a weapon the character is proficient with.
   */
  v.object({
    type: v.literal("weaponAbility"),
    ability: AbilitySchema,
    when: v.optional(v.picklist(["oneHanded", "magic"])),
    proficient: v.optional(v.boolean()),
  }),
  /** Resistance, immunity or vulnerability to a type of damage (`fire`, `poison`...). */
  v.object({
    type: v.literal("defense"),
    kind: v.picklist(["resistance", "immunity", "vulnerability"]),
    damage: v.string(),
  }),
  /**
   * Half the proficiency bonus on ability checks that do not use it (Jack of All Trades,
   * Remarkable Athlete): all abilities, or just those listed.
   */
  v.object({
    type: v.literal("halfProficiency"),
    round: v.picklist(["down", "up"]),
    abilities: v.optional(v.array(AbilitySchema)),
  }),
  /**
   * Armor class without body armor: `base` + Dexterity + the abilities in `add`. Barbarian and
   * monk use 10; a draconic sorcerer 13. `shield` says whether a shield may be carried.
   */
  v.object({
    type: v.literal("unarmoredDefense"),
    base: v.number(),
    add: v.array(AbilitySchema),
    shield: v.boolean(),
  }),
  v.object({
    type: v.literal("resource"),
    id: v.string(),
    max: v.pipe(v.number(), v.integer(), v.minValue(0)),
    recharge: v.picklist(["short", "long", "dawn"]),
  }),
]);

/**
 * Effects that hold only while a requirement does. `requires` is written as Aurora writes them:
 * names of entries or flags, `,` for "and", `||` for "or", `!` for "not", brackets to group. It is
 * checked every time the sheet is worked out, against what the character has then.
 */
export type Effect =
  | v.InferOutput<typeof PlainEffectSchema>
  | { type: "when"; requires: string; effects: Effect[] };

export const EffectSchema: v.GenericSchema<Effect> = v.union([
  PlainEffectSchema,
  v.object({
    type: v.literal("when"),
    requires: v.string(),
    effects: v.array(v.lazy(() => EffectSchema)),
  }),
]);

export const ENTRY_KINDS = [
  "species",
  "subspecies",
  "class",
  "subclass",
  "feature",
  "background",
  "trait",
  "spell",
  "item",
  "property",
  "ability",
  "skill",
  "language",
  "feat",
  "proficiency",
  "school",
  "condition",
  "alignment",
  "deity",
  "option",
] as const;

export const EntrySchema = v.object({
  id: EntryIdSchema,
  kind: v.picklist(ENTRY_KINDS),
  parent: v.optional(EntryIdSchema),
  effects: v.optional(v.array(EffectSchema), []),
  /** Kind-specific structured facts (spell level, speed, ...). Never display text. */
  data: v.optional(v.record(v.string(), v.unknown()), {}),
});
export type Entry = v.InferOutput<typeof EntrySchema>;

export const PackManifestSchema = v.object({
  id: v.pipe(v.string(), v.regex(/^[a-z0-9]+$/)),
  ruleset: v.picklist(["srd51", "srd52", "custom"]),
  version: v.string(),
  license: v.string(),
  attribution: v.string(),
});

export const PackSchema = v.pipe(
  v.object({
    manifest: PackManifestSchema,
    entries: v.array(EntrySchema),
  }),
  v.check(
    (pack) => pack.entries.every((e) => e.id.startsWith(`${pack.manifest.id}:`)),
    "Every entry id must start with the pack id",
  ),
  v.check(
    (pack) => pack.entries.every((e) => e.id.split(":")[1]?.startsWith(`${e.kind}/`)),
    "Every entry id must contain its kind: `pack:kind/slug`",
  ),
  v.check(
    (pack) => new Set(pack.entries.map((e) => e.id)).size === pack.entries.length,
    "Entry ids must be unique within a pack",
  ),
);
export type Pack = v.InferOutput<typeof PackSchema>;

/** Parses untrusted pack JSON; throws a ValiError describing the first problems. */
export function parsePack(input: unknown): Pack {
  return v.parse(PackSchema, input);
}

/**
 * Checks that ids referenced by `parent`, `trait`, `grantSpell` and trait/spell choices
 * exist in the given packs. Returns human-readable problems (empty when all resolve).
 */
export function findBrokenReferences(packs: Pack[]): string[] {
  return brokenReferences(packs).map((p) => `${p.from} references missing ${p.ref}`);
}

/** The same check, with the entry that refers and the id it cannot find. */
export function brokenReferences(packs: Pack[]): { from: string; ref: string }[] {
  const known = new Set(packs.flatMap((p) => p.entries.map((e) => e.id)));
  const problems: { from: string; ref: string }[] = [];
  const check = (from: string, ref: string) => {
    if (!known.has(ref)) problems.push({ from, ref });
  };
  for (const entry of packs.flatMap((p) => p.entries)) {
    if (entry.parent) check(entry.id, entry.parent);
    const visit = (effects: Effect[]) => {
      for (const effect of effects) {
        if (effect.type === "trait") check(entry.id, effect.id);
        else if (effect.type === "grantSpell") check(entry.id, effect.spell);
        else if (effect.type === "when") visit(effect.effects);
        else if (
          effect.type === "choice" &&
          (effect.grants === "spell" || effect.grants === "trait")
        )
          for (const ref of effect.from) check(entry.id, ref);
      }
    };
    visit(entry.effects);
  }
  return problems;
}
