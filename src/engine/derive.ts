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
import { type ChecksResult, deriveChecks, halfBonus } from "./checks";
import { type PendingChoice, collectEffects } from "./choices";
import { customResources } from "./custom";
import { type EquipmentResult, deriveEquipment, proficiencyKeys } from "./equipment";
import { type AppliedModifier, appliedModifiers, total } from "./modifiers";
import { type CasterInput, casterKind, slotPools, unmetPrerequisites } from "./multiclass";
import { OVERRIDE, numberOverride } from "./overrides";
import { type ClassFact, type ClassResource, type ExtraDamage, classResources } from "./resources";
import { type FeatureSource, featureSources } from "./sources";
import { type SpellLists, deriveSpellLists } from "./spells";
import { withSubclassCasting } from "./subclassCasting";
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
  /** Pact Magic: slots come back on a short rest. */
  pact: boolean;
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
  /**
   * The bonuses that features and choices give right now, with where each comes from: armor
   * class, speed, initiative, hit points per level, and attack and damage rolls.
   */
  bonuses: AppliedModifier[];
  /** Walking speed in feet; undefined while no species is chosen. */
  speed?: number;
  abilities: Record<Ability, AbilityResult>;
  hitPoints: { max: number; overridden: boolean; hitDice: Record<string, number> };
  proficiencies: Record<ProficiencyCategory, string[]>;
  traits: string[];
  /** Damage types the character resists, is immune to or is vulnerable to. */
  defenses: Record<"resistance" | "immunity" | "vulnerability", string[]>;
  /** Class and subclass features unlocked at the current levels. */
  features: string[];
  /** Where each feature and trait comes from, to name it next to the text. */
  featureSources: Record<string, FeatureSource>;
  /** The first spellcasting class: the one whose numbers the sheet headlines. */
  spellcasting?: SpellcastingResult;
  /** Every spellcasting class, in the order the character took them. */
  spellcasters: SpellcastingResult[];
  /** Spell slots of levels 1..9 shared by all spellcasting classes. */
  spellSlots: number[];
  /** Limited-use class features (rages, ki, channel divinity...) and their recovery. */
  resources: ClassResource[];
  /** Class numbers worth showing during play: sneak attack dice, rage damage and the like. */
  facts: ClassFact[];
  /** Damage the classes add to attacks: sneak attack, rage, smite... */
  extraDamage: ExtraDamage[];
  /** Pact Magic slots kept apart when a warlock multiclasses; they return on a short rest. */
  pactSlots?: { level: number; count: number };
  /** Choices offered by the current picks (species, class, background, traits), with their state. */
  choices: PendingChoice[];
  /** Spells granted outright or by a choice (e.g. a High Elf cantrip). */
  grantedSpells: string[];
  /** Feats the character took. */
  feats: string[];
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

/** A feature that offers more picks as the class grows takes the number from the class table. */
function sizeChoices(feature: Entry, table: Record<string, unknown> | undefined): Entry {
  if (!feature.effects.some((e) => e.type === "choice" && e.chooseBy)) return feature;
  const effects = feature.effects.flatMap((e) => {
    if (e.type !== "choice" || !e.chooseBy) return [e];
    const size = table?.[e.chooseBy];
    return typeof size === "number" && size > 0 ? [{ ...e, choose: size }] : [];
  });
  return { ...feature, effects };
}

function defensesOf(effects: Effect[]): DerivedSheet["defenses"] {
  const found: DerivedSheet["defenses"] = { resistance: [], immunity: [], vulnerability: [] };
  for (const e of effects) {
    if (e.type === "defense" && !found[e.kind].includes(e.damage)) found[e.kind].push(e.damage);
  }
  return found;
}

function overrideNumber(character: Character, key: string): number | undefined {
  const value = character.overrides[key];
  return typeof value === "number" ? value : undefined;
}

export function deriveSheet(character: Character, index: PackIndex): DerivedSheet {
  const warnings: Warning[] = [];

  // Species, subspecies, background and the starting class contribute their effects;
  // other classes only contribute their multiclass proficiencies.
  const featIds = character.feats ?? [];
  // An option whose pack is gone is left out quietly: it is a switch, not something chosen.
  const options = (character.options ?? []).filter((id) => index.has(id));
  const chosen = [...Object.values(character.choices), ...featIds, ...options]
    .filter((id): id is string => Boolean(id))
    .flatMap((id) => lookup(index, id, warnings) ?? []);
  const classEntries = character.classes.map((cl) => ({
    cl,
    entry: lookup(index, cl.classId, warnings),
  }));
  const [starting, ...others] = classEntries;

  // The features a class has reached, and its subclass's, add their effects and offer their
  // choices (a fighting style) like species and background do. A choice whose size grows with
  // the class (invocations, metamagic) takes its size from the class table.
  const reached: Entry[] = [];
  for (const { cl, entry } of classEntries) {
    if (!entry) continue;
    const ids: string[] = [];
    for (const l of classData(entry).levels) if (l.level <= cl.level) ids.push(...l.features);
    const sub = cl.subclassId ? index.get(cl.subclassId) : undefined;
    if (sub?.parent === cl.classId)
      for (const l of subclassData(sub).levels) if (l.level <= cl.level) ids.push(...l.features);
    const row = classData(entry).levels.find((l) => l.level === cl.level);
    for (const id of ids) {
      const feature = index.get(id);
      if (feature) reached.push(sizeChoices(feature, row?.classSpecific));
    }
  }
  /** The level that counts for what an entry gives: its class's, or the whole character's. */
  const levelOf = (source: string) => {
    const owner = index.get(source)?.data.class;
    return owner
      ? (character.classes.find((cl) => cl.classId === owner)?.level ?? 0)
      : character.classes.reduce((sum, cl) => sum + cl.level, 0);
  };
  // What the character has equipped adds its effects, like a ring that grants a resistance.
  const wornWithEffects = character.inventory
    .filter((i) => i.equipped)
    .flatMap((i) =>
      [i.itemId, i.enchantment].flatMap((id) => {
        const entry = id ? index.get(id) : undefined;
        return entry && entry.effects.length > 0 ? [entry] : [];
      }),
    );
  // A variant of a species (a half-elf of another descent) carries the species' effects itself.
  const standsIn = chosen.some((e) => e.kind === "subspecies" && e.data.replacesSpecies === true);
  const contributing = standsIn ? chosen.filter((e) => e.kind !== "species") : chosen;
  const { effects, sourced, choices } = collectEffects(
    [...contributing, ...wornWithEffects, ...(starting?.entry ? [starting.entry] : []), ...reached],
    { index, selections: character.selections, warnings },
    [
      ...character.classes.flatMap((cl) => [cl.classId, cl.subclassId ?? ""]),
      ...Object.values(character.choices),
    ].filter((id): id is string => Boolean(id)),
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
  // Feats take their improvements first; the rest of the slots are ability increases.
  if (character.asi.length + featIds.length > asiAvailable)
    warn(warnings, "asiTooMany", { available: asiAvailable });
  let asiUsed = Math.min(featIds.length, asiAvailable);
  character.asi.slice(0, Math.max(0, asiAvailable - featIds.length)).forEach((slot, i) => {
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
    const floor = effects.reduce(
      (most, e) =>
        e.type === "abilityFloor" && e.ability === ability ? Math.max(most, e.value) : most,
      0,
    );
    const score = override ?? Math.max(base + bonus, floor);
    if (!overridden && score > 20) warn(warnings, "abilityTooHigh", { ability, score });
    abilities[ability] = {
      base,
      bonus: overridden ? bonus : score - base,
      score,
      modifier: abilityModifier(score),
      overridden,
    };
  }

  // A feat may ask for minimum ability scores.
  for (const entry of chosen) {
    if (entry.kind !== "feat") continue;
    const needs =
      (entry.data.prerequisites as { ability: Ability; minimum: number }[] | undefined) ?? [];
    for (const need of needs) {
      if (abilities[need.ability].score < need.minimum)
        warn(warnings, "featPrerequisite", {
          feat: entry.id,
          ability: need.ability,
          minimum: need.minimum,
        });
    }
  }

  // A character can attune to three items at once.
  const attuned = character.inventory.filter(
    (i) =>
      i.equipped &&
      (index.get(i.itemId)?.data.attunement === true ||
        (i.enchantment !== undefined && index.get(i.enchantment)?.data.attunement === true)),
  ).length;
  if (attuned > 3) warn(warnings, "attunementTooMany", { count: attuned });

  // Hit points, features, spellcasting
  const conMod = abilities.con.modifier;
  let hp = 0;
  const hitDice: Record<string, number> = {};
  const features: string[] = [];
  const casters: SpellcastingResult[] = [];
  const casterInputs: CasterInput[] = [];
  const resources: ClassResource[] = customResources(character.custom ?? []);
  const facts: ClassFact[] = [];
  const extraDamage: ExtraDamage[] = [];
  classEntries.forEach(({ cl, entry }, position) => {
    if (!entry) return;
    const data = classData(entry);
    hitDice[`d${data.hitDie}`] = (hitDice[`d${data.hitDie}`] ?? 0) + cl.level;
    for (let lvl = 1; lvl <= cl.level; lvl++) {
      const first = position === 0 && lvl === 1;
      const roll = first ? data.hitDie : (cl.hpRolls?.[lvl - 1] ?? Math.floor(data.hitDie / 2) + 1);
      hp += Math.max(1, roll + conMod);
    }

    for (const l of data.levels) if (l.level <= cl.level) features.push(...l.features);
    const classBits = classResources({
      classId: cl.classId,
      level: cl.level,
      data,
      modifier: (a) => abilities[a].modifier,
    });
    resources.push(...classBits.resources);
    facts.push(...classBits.facts);
    extraDamage.push(...classBits.extras);

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

    // A class without spellcasting may get it from its subclass (Eldritch Knight).
    const subCasting = subEntry ? subclassData(subEntry).spellcasting : undefined;
    const cast = (subEntry && withSubclassCasting(data, subclassData(subEntry))) || data;
    const castRow = cast.levels.find((l) => l.level === cl.level);
    if (cast.spellcasting && cl.level >= cast.spellcasting.startsAtLevel && castRow?.spellSlots) {
      const kind = subCasting && cast !== data ? subCasting.kind : casterKind(cl.classId, data);
      if (kind) casterInputs.push({ kind, level: cl.level, ownSlots: castRow.spellSlots });
      const ability = cast.spellcasting.ability;
      const modifier = abilities[ability].modifier;
      casters.push({
        classId: cl.classId,
        pact: kind === "pact",
        ability,
        saveDc:
          numberOverride(character.overrides, OVERRIDE.spellSaveDc) ??
          8 + proficiencyBonus + modifier,
        attackBonus:
          numberOverride(character.overrides, OVERRIDE.spellAttack) ?? proficiencyBonus + modifier,
        ...(castRow.cantripsKnown !== undefined && { cantripsKnown: castRow.cantripsKnown }),
        ...(castRow.spellsKnown !== undefined && { spellsKnown: castRow.spellsKnown }),
        spellSlots: castRow.spellSlots,
        lists: deriveSpellLists({
          classId: subCasting && cast !== data ? subCasting.list : cl.classId,
          data: cast,
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
  // Several casting classes share their slots; each class keeps its own spell lists.
  const pools = slotPools(casterInputs);
  for (const caster of casters) caster.spellSlots = pools.slots;
  const spellcasting = casters[0];

  // Multiclassing asks for a minimum in the key abilities of every class involved.
  if (classEntries.length > 1) {
    for (const { cl, entry } of classEntries) {
      if (!entry) continue;
      for (const need of unmetPrerequisites(classData(entry), (a) => abilities[a].score))
        warn(warnings, "multiclassPrerequisite", {
          class: cl.classId,
          ability: need.ability,
          minimum: need.minimum,
        });
    }
  }

  // Proficiencies and traits
  const proficiencies = Object.fromEntries(
    PROFICIENCY_CATEGORIES.map((c) => [c, [] as string[]]),
  ) as Record<ProficiencyCategory, string[]>;
  const traits: string[] = [];
  // A feat that a species, background or class gives (or lets you pick) is listed as a feat.
  const givenFeats: string[] = [];
  for (const effect of effects) {
    if (effect.type === "proficiency") {
      const list = proficiencies[effect.category];
      if (!list.includes(effect.target)) list.push(effect.target);
    } else if (effect.type === "trait") {
      if (index.get(effect.id)?.kind === "feat") {
        if (!givenFeats.includes(effect.id)) givenFeats.push(effect.id);
      } else if (!traits.includes(effect.id)) traits.push(effect.id);
    }
  }

  const held = proficiencyKeys(proficiencies);
  const equipment = deriveEquipment({
    character,
    index,
    abilities,
    held,
    proficiencyBonus,
    sourced,
    levelOf,
    warnings,
    spellAbilities: casters.map((c) => c.ability),
  });

  // Expertise doubles the proficiency bonus of skills the character is proficient in.
  const expertise = new Set<string>();
  for (const effect of effects) {
    if (effect.type !== "expertise") continue;
    const isSkill = index.has(`${character.ruleset}:skill/${effect.skill}`);
    if (isSkill && !held.has(`skill:${effect.skill}`))
      warn(warnings, "expertiseNeedsProficiency", {
        skill: `${character.ruleset}:skill/${effect.skill}`,
      });
    else if (isSkill) expertise.add(effect.skill);
  }
  const halves = effects.flatMap((e) =>
    e.type === "halfProficiency"
      ? [{ round: e.round, ...(e.abilities && { abilities: e.abilities }) }]
      : [],
  );

  // What a feature asks of its options: a level, or another feature.
  const known = new Set([...reached.map((e) => e.id), ...traits]);
  for (const choice of choices) {
    if (choice.grants !== "trait") continue;
    for (const id of choice.selected) {
      const option = index.get(id);
      const needs = (option?.data.prerequisites ?? []) as {
        type: string;
        level?: number;
        feature?: string;
      }[];
      for (const need of needs) {
        if (need.type === "level" && need.level !== undefined && levelOf(id) < need.level)
          warn(warnings, "optionLevel", { option: id, level: need.level });
        if (need.type === "feature" && need.feature && !known.has(need.feature))
          warn(warnings, "optionFeature", { option: id, feature: need.feature });
      }
    }
  }
  const checks = deriveChecks({
    index,
    ruleset: character.ruleset,
    abilities,
    held,
    proficiencyBonus,
    expertise,
    halves,
    overrides: character.overrides,
    saveBonus: total(appliedModifiers(sourced, "save", { armor: equipment.armor, levelOf })),
  });
  const baseSpeed = chosen.find((e) => e.kind === "species")?.data.speed;
  const state = { armor: equipment.armor, levelOf };
  const speedMods = appliedModifiers(sourced, "speed", state);
  const initiativeMods = appliedModifiers(sourced, "initiative", state);
  const hpMods = appliedModifiers(sourced, "hpPerLevel", state);
  const speed =
    overrideNumber(character, "speed") ??
    (typeof baseSpeed === "number" ? baseSpeed + total(speedMods) : undefined);
  // A feature of a class counts that class's levels; a trait of the species counts all of them.
  const hpBonus = hpMods.reduce((sum, m) => {
    const owner = index.get(m.source)?.data.class;
    const levels = owner
      ? (character.classes.find((cl) => cl.classId === owner)?.level ?? 0)
      : level;
    return sum + m.value * levels;
  }, 0);

  // Where each bonus comes from, once, for the sheet to show.
  const bonuses: AppliedModifier[] = [];
  const seen = new Set<string>();
  const note = (m: AppliedModifier) => {
    const key = `${m.target}|${m.source}|${m.value}`;
    if (seen.has(key)) return;
    seen.add(key);
    bonuses.push(m);
  };
  for (const part of equipment.armorClass.parts)
    if (part.source === "feature" && part.feature)
      note({ target: "ac", value: part.value, source: part.feature });
  for (const m of [...speedMods, ...initiativeMods, ...hpMods]) note(m);
  for (const attack of equipment.attacks) for (const m of attack.modifiers ?? []) note(m);

  return {
    ...equipment,
    ...checks,
    initiative:
      overrideNumber(character, "initiative") ??
      abilities.dex.modifier + halfBonus(halves, "dex", proficiencyBonus) + total(initiativeMods),
    bonuses,
    ...(speed !== undefined && { speed }),
    level,
    proficiencyBonus,
    abilities,
    hitPoints: { max: hpOverride ?? hp + hpBonus, overridden: hpOverride !== undefined, hitDice },
    proficiencies,
    traits,
    defenses: defensesOf(effects),
    features: [...new Set(features)],
    featureSources: featureSources(index, character, sourced),
    ...(spellcasting && { spellcasting }),
    spellcasters: casters,
    resources,
    facts,
    extraDamage,
    spellSlots: pools.slots,
    ...(pools.pact && { pactSlots: pools.pact }),
    choices,
    grantedSpells: [
      ...new Set(
        sourced.flatMap(({ effect, source }) =>
          effect.type === "grantSpell" &&
          (effect.minLevel === undefined || levelOf(source) >= effect.minLevel)
            ? [effect.spell]
            : [],
        ),
      ),
    ],
    feats: [
      ...new Set([...chosen.filter((e) => e.kind === "feat").map((e) => e.id), ...givenFeats]),
    ],
    asi: { available: asiAvailable, used: asiUsed },
    warnings,
  };
}
