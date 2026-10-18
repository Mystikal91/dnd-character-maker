import * as v from "valibot";
import { AbilitySchema, type Entry, EntryIdSchema } from "./schema";

const ScoreRequirementSchema = v.object({
  ability: AbilitySchema,
  minimum: v.number(),
});

const LevelRowSchema = v.object({
  level: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20)),
  /** Features gained at this level (class features only; no cumulative list). */
  features: v.array(EntryIdSchema),
  /** Cumulative number of ability score improvements available at this level. */
  abilityScoreImprovements: v.number(),
  cantripsKnown: v.optional(v.number()),
  spellsKnown: v.optional(v.number()),
  /** Spell slots for spell levels 1..9. */
  spellSlots: v.optional(v.array(v.number())),
  classSpecific: v.optional(v.record(v.string(), v.unknown()), {}),
});
export type LevelRow = v.InferOutput<typeof LevelRowSchema>;

/** The parts of a `class` entry's `data` that the engine reads. */
export const ClassDataSchema = v.object({
  hitDie: v.number(),
  spellcasting: v.optional(
    v.object({
      ability: AbilitySchema,
      startsAtLevel: v.number(),
    }),
  ),
  multiclassing: v.object({
    /** All of these must be met. */
    prerequisites: v.array(ScoreRequirementSchema),
    /** At least `choose` of these must be met. */
    prerequisiteOptions: v.optional(
      v.object({ choose: v.number(), from: v.array(ScoreRequirementSchema) }),
    ),
    /** `category:target` proficiencies gained when multiclassing into this class. */
    proficiencies: v.array(v.string()),
  }),
  levels: v.array(LevelRowSchema),
});
export type ClassData = v.InferOutput<typeof ClassDataSchema>;

/** The parts of a `subclass` entry's `data` that the engine reads. */
export const SubclassDataSchema = v.object({
  levels: v.array(
    v.object({
      level: v.number(),
      features: v.array(EntryIdSchema),
    }),
  ),
  /** Spells always prepared once the class reaches `classLevel`. */
  spells: v.array(v.object({ spell: EntryIdSchema, classLevel: v.number() })),
});
export type SubclassData = v.InferOutput<typeof SubclassDataSchema>;

export function classData(entry: Entry): ClassData {
  return v.parse(ClassDataSchema, entry.data);
}

export function subclassData(entry: Entry): SubclassData {
  return v.parse(SubclassDataSchema, entry.data);
}
