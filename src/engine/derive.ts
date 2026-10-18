import { classData, subclassData } from "../data/progression";
import {
  ABILITIES,
  type Ability,
  type Effect,
  type Entry,
  PROFICIENCY_CATEGORIES,
  type Pack,
  type ProficiencyCategory,
} from "../data/schema";
import { abilityModifier } from "./abilities";
import type { Character } from "./character";
import { type EquipmentResult, deriveEquipment, proficiencyKeys } from "./equipment";

export type PackIndex = Map<string, Entry>;

export function indexPacks(...packs: Pack[]): PackIndex {
  const index: PackIndex = new Map();
  for (const pack of packs) for (const entry of pack.entries) index.set(entry.id, entry);
  return index;
}

export interface AbilityResult {
  base: number;
  bonus: number;
  score: number;
  modifier: number;
  overridden: boolean;
}

export interface SpellcastingResult {
  classId: string;
  ability: Ability;
  saveDc: number;
  attackBonus: number;
  cantripsKnown?: number;
  spellsKnown?: number;
  /** Slots for spell levels 1..9. */
  spellSlots: number[];
}

export interface DerivedSheet extends EquipmentResult {
  /** Total character level (0 while no class is chosen). */
  level: number;
  proficiencyBonus: number;
  abilities: Record<Ability, AbilityResult>;
  hitPoints: { max: number; overridden: boolean; hitDice: Record<string, number> };
  proficiencies: Record<ProficiencyCategory, string[]>;
  traits: string[];
  /** Class and subclass features unlocked at the current levels. */
  features: string[];
  spellcasting?: SpellcastingResult;
  /** Problems found while deriving. Never blocking: the sheet is still produced. */
  warnings: string[];
}

const MAX_LEVEL = 20;

export const proficiencyBonusForLevel = (level: number) => Math.ceil(Math.max(level, 1) / 4) + 1;

function lookup(index: PackIndex, id: string, warnings: string[]): Entry | undefined {
  const entry = index.get(id);
  if (!entry) warnings.push(`Unknown entry: ${id}`);
  return entry;
}

/**
 * Effects of the given entries, following `trait` effects into the trait entries they
 * name (so a species gets the proficiencies of its traits). Each trait is expanded once.
 */
function expandEffects(
  entries: Entry[],
  index: PackIndex,
  warnings: string[],
  seen = new Set<string>(),
): Effect[] {
  const result: Effect[] = [];
  for (const entry of entries) {
    for (const effect of entry.effects) {
      result.push(effect);
      if (effect.type !== "trait" || seen.has(effect.id)) continue;
      seen.add(effect.id);
      const trait = lookup(index, effect.id, warnings);
      if (trait) result.push(...expandEffects([trait], index, warnings, seen));
    }
  }
  return result;
}

function overrideNumber(character: Character, key: string): number | undefined {
  const value = character.overrides[key];
  return typeof value === "number" ? value : undefined;
}

export function deriveSheet(character: Character, index: PackIndex): DerivedSheet {
  const warnings: string[] = [];

  // Species, subspecies, background and the starting class contribute their effects;
  // other classes only contribute their multiclass proficiencies.
  const chosen = Object.values(character.choices)
    .filter((id): id is string => Boolean(id))
    .flatMap((id) => lookup(index, id, warnings) ?? []);
  const classEntries = character.classes.map((cl) => ({
    cl,
    entry: lookup(index, cl.classId, warnings),
  }));
  const [starting, ...others] = classEntries;
  const effects = expandEffects(
    [...chosen, ...(starting?.entry ? [starting.entry] : [])],
    index,
    warnings,
  );
  for (const { entry } of others) {
    if (!entry) continue;
    for (const key of classData(entry).multiclassing.proficiencies) {
      const [category, target] = key.split(":") as [ProficiencyCategory, string];
      effects.push({ type: "proficiency", category, target });
    }
  }

  // Levels
  const level = character.classes.reduce((sum, cl) => sum + cl.level, 0);
  if (level > MAX_LEVEL) warnings.push(`Total level is above ${MAX_LEVEL} (${level})`);
  const proficiencyBonus =
    overrideNumber(character, "proficiencyBonus") ?? proficiencyBonusForLevel(level);

  // Abilities
  const abilities = {} as Record<Ability, AbilityResult>;
  for (const ability of ABILITIES) {
    const base = character.abilityBase[ability];
    const bonus = effects.reduce(
      (sum, e) => (e.type === "abilityBonus" && e.ability === ability ? sum + e.value : sum),
      0,
    );
    const override = overrideNumber(character, `ability.${ability}`);
    const overridden = override !== undefined;
    const score = override ?? base + bonus;
    if (!overridden && score > 20) warnings.push(`${ability} is above 20 (${score})`);
    abilities[ability] = { base, bonus, score, modifier: abilityModifier(score), overridden };
  }

  // Hit points, features, spellcasting
  const conMod = abilities.con.modifier;
  let hp = 0;
  const hitDice: Record<string, number> = {};
  const features: string[] = [];
  const casters: SpellcastingResult[] = [];
  classEntries.forEach(({ cl, entry }, position) => {
    if (!entry) return;
    const data = classData(entry);
    hitDice[`d${data.hitDie}`] = (hitDice[`d${data.hitDie}`] ?? 0) + cl.level;
    for (let lvl = 1; lvl <= cl.level; lvl++) {
      const first = position === 0 && lvl === 1;
      const roll = first ? data.hitDie : (cl.hpRolls?.[lvl - 1] ?? Math.floor(data.hitDie / 2) + 1);
      hp += Math.max(1, roll + conMod);
    }

    const row = data.levels.find((l) => l.level === cl.level);
    for (const l of data.levels) if (l.level <= cl.level) features.push(...l.features);

    if (cl.subclassId) {
      const sub = lookup(index, cl.subclassId, warnings);
      if (sub) {
        if (sub.parent !== cl.classId)
          warnings.push(`${cl.subclassId} is not a subclass of ${cl.classId}`);
        for (const l of subclassData(sub).levels)
          if (l.level <= cl.level) features.push(...l.features);
      }
    }

    if (data.spellcasting && cl.level >= data.spellcasting.startsAtLevel && row?.spellSlots) {
      const ability = data.spellcasting.ability;
      const modifier = abilities[ability].modifier;
      casters.push({
        classId: cl.classId,
        ability,
        saveDc: 8 + proficiencyBonus + modifier,
        attackBonus: proficiencyBonus + modifier,
        ...(row.cantripsKnown !== undefined && { cantripsKnown: row.cantripsKnown }),
        ...(row.spellsKnown !== undefined && { spellsKnown: row.spellsKnown }),
        spellSlots: row.spellSlots,
      });
    }
  });
  const hpOverride = overrideNumber(character, "hp.max");
  const spellcasting = casters.length === 1 ? casters[0] : undefined;
  if (casters.length > 1) warnings.push("Multiclass spellcasting is not supported yet");

  // Proficiencies and traits
  const proficiencies = Object.fromEntries(
    PROFICIENCY_CATEGORIES.map((c) => [c, [] as string[]]),
  ) as Record<ProficiencyCategory, string[]>;
  const traits: string[] = [];
  for (const effect of effects) {
    if (effect.type === "proficiency") {
      const list = proficiencies[effect.category];
      if (!list.includes(effect.target)) list.push(effect.target);
    } else if (effect.type === "trait" && !traits.includes(effect.id)) {
      traits.push(effect.id);
    }
  }

  const equipment = deriveEquipment({
    character,
    index,
    abilities,
    held: proficiencyKeys(proficiencies),
    proficiencyBonus,
    warnings,
  });

  return {
    ...equipment,
    level,
    proficiencyBonus,
    abilities,
    hitPoints: { max: hpOverride ?? hp, overridden: hpOverride !== undefined, hitDice },
    proficiencies,
    traits,
    features: [...new Set(features)],
    ...(spellcasting && { spellcasting }),
    warnings,
  };
}
