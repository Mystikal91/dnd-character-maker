import { classData, subclassData } from "../data/progression";
import {
  ABILITIES,
  type Ability,
  type Entry,
  PROFICIENCY_CATEGORIES,
  type Pack,
  type ProficiencyCategory,
} from "../data/schema";
import { abilityModifier } from "./abilities";
import type { Character } from "./character";
import { type ChecksResult, deriveChecks } from "./checks";
import { type PendingChoice, collectEffects } from "./choices";
import { type EquipmentResult, deriveEquipment, proficiencyKeys } from "./equipment";
import { type SpellLists, deriveSpellLists } from "./spells";
import { type Warning, warn } from "./warnings";

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
  /** What the class may pick and what is picked. */
  lists: SpellLists;
}

export interface DerivedSheet extends EquipmentResult, ChecksResult {
  /** Total character level (0 while no class is chosen). */
  level: number;
  proficiencyBonus: number;
  initiative: number;
  /** Walking speed in feet; undefined while no species is chosen. */
  speed?: number;
  abilities: Record<Ability, AbilityResult>;
  hitPoints: { max: number; overridden: boolean; hitDice: Record<string, number> };
  proficiencies: Record<ProficiencyCategory, string[]>;
  traits: string[];
  /** Class and subclass features unlocked at the current levels. */
  features: string[];
  spellcasting?: SpellcastingResult;
  /** Choices offered by the current picks (species, class, background, traits), with their state. */
  choices: PendingChoice[];
  /** Spells granted outright or by a choice (e.g. a High Elf cantrip). */
  grantedSpells: string[];
  /** Ability Score Improvements available from class levels and how many are taken. */
  asi: { available: number; used: number };
  /** Problems found while deriving. Never blocking: the sheet is still produced. */
  warnings: Warning[];
}

const MAX_LEVEL = 20;

export const proficiencyBonusForLevel = (level: number) => Math.ceil(Math.max(level, 1) / 4) + 1;

function lookup(index: PackIndex, id: string, warnings: Warning[]): Entry | undefined {
  const entry = index.get(id);
  if (!entry) warn(warnings, "unknownEntry", { id });
  return entry;
}

function overrideNumber(character: Character, key: string): number | undefined {
  const value = character.overrides[key];
  return typeof value === "number" ? value : undefined;
}

export function deriveSheet(character: Character, index: PackIndex): DerivedSheet {
  const warnings: Warning[] = [];

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
  const { effects, choices } = collectEffects(
    [...chosen, ...(starting?.entry ? [starting.entry] : [])],
    { index, selections: character.selections, warnings },
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
  if (level > MAX_LEVEL) warn(warnings, "levelTooHigh", { level, max: MAX_LEVEL });
  const proficiencyBonus =
    overrideNumber(character, "proficiencyBonus") ?? proficiencyBonusForLevel(level);

  // Ability Score Improvements: +2 to one ability or +1 to two different ones, per slot.
  const asiAvailable = classEntries.reduce((sum, { cl, entry }) => {
    const row = entry && classData(entry).levels.find((l) => l.level === cl.level);
    return sum + (row?.abilityScoreImprovements ?? 0);
  }, 0);
  if (character.asi.length > asiAvailable)
    warn(warnings, "asiTooMany", { available: asiAvailable });
  let asiUsed = 0;
  character.asi.slice(0, asiAvailable).forEach((slot, i) => {
    if (new Set(slot).size !== slot.length) {
      warn(warnings, "asiInvalid", { slot: i + 1 });
      return;
    }
    asiUsed += 1;
    for (const ability of slot) {
      effects.push({ type: "abilityBonus", ability, value: slot.length === 1 ? 2 : 1 });
    }
  });

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
    if (!overridden && score > 20) warn(warnings, "abilityTooHigh", { ability, score });
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

    let subEntry: Entry | undefined;
    if (cl.subclassId) {
      const sub = lookup(index, cl.subclassId, warnings);
      subEntry = sub;
      if (sub) {
        if (sub.parent !== cl.classId)
          warn(warnings, "subclassMismatch", { subclass: cl.subclassId, class: cl.classId });
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
        lists: deriveSpellLists({
          classId: cl.classId,
          data,
          level: cl.level,
          abilityModifier: modifier,
          picks: character.spells[cl.classId],
          index,
          subclass: subEntry,
          warnings,
        }),
      });
    }
  });
  const hpOverride = overrideNumber(character, "hp.max");
  const spellcasting = casters.length === 1 ? casters[0] : undefined;
  if (casters.length > 1) warn(warnings, "multiclassSpellcasting");

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

  const held = proficiencyKeys(proficiencies);
  const equipment = deriveEquipment({
    character,
    index,
    abilities,
    held,
    proficiencyBonus,
    warnings,
  });
  const checks = deriveChecks({
    index,
    ruleset: character.ruleset,
    abilities,
    held,
    proficiencyBonus,
  });
  const baseSpeed = chosen.find((e) => e.kind === "species")?.data.speed;
  const speed =
    overrideNumber(character, "speed") ?? (typeof baseSpeed === "number" ? baseSpeed : undefined);

  return {
    ...equipment,
    ...checks,
    initiative: overrideNumber(character, "initiative") ?? abilities.dex.modifier,
    ...(speed !== undefined && { speed }),
    level,
    proficiencyBonus,
    abilities,
    hitPoints: { max: hpOverride ?? hp, overridden: hpOverride !== undefined, hitDice },
    proficiencies,
    traits,
    features: [...new Set(features)],
    ...(spellcasting && { spellcasting }),
    choices,
    grantedSpells: [...new Set(effects.flatMap((e) => (e.type === "grantSpell" ? [e.spell] : [])))],
    asi: { available: asiAvailable, used: asiUsed },
    warnings,
  };
}
