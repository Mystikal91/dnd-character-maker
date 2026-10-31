import { itemData } from "../data/items";
import type { Ability, ProficiencyCategory } from "../data/schema";
import type { Character } from "./character";
import type { SourcedEffect } from "./choices";
import { coinWeight } from "./coins";
import type { AbilityResult, PackIndex } from "./derive";
import { type AppliedModifier, type ArmorState, appliedModifiers, total } from "./modifiers";
import { type Warning, warn } from "./warnings";

export interface DamageResult {
  dice: string;
  bonus: number;
  type: string;
}

export interface AttackResult {
  itemId: string;
  ability: Ability;
  /** The entry that lets the weapon use an ability other than Strength or Dexterity. */
  abilityFrom?: string;
  /** The cantrip Shillelagh is on the weapon. */
  shillelagh?: boolean;
  /** The attack is made at range. */
  ranged: boolean;
  /** The weapon counts as magic. */
  magical: boolean;
  /** The bonus to attack and damage rolls from a spell or an enchantment. */
  enhancement: number;
  /** The enchantment the weapon carries, when it has one. */
  enchantment?: string;
  attackBonus: number;
  proficient: boolean;
  damage?: DamageResult;
  twoHandedDamage?: DamageResult;
  properties: string[];
  range: { normal: number; long?: number };
  /** The bonuses of features and choices that apply to this attack, when there are any. */
  modifiers?: AppliedModifier[];
}

export interface ArmorClassResult {
  value: number;
  overridden: boolean;
  stealthDisadvantage: boolean;
  /** What the value is made of, for display. Sources are keys, not text. */
  parts: {
    source: "base" | "armor" | "dex" | "shield" | "feature";
    value: number;
    /** The entry that gives a `feature` part. */
    feature?: string;
  }[];
}

export interface LoadResult {
  /** Carried weight in pounds. */
  carried: number;
  /** Carrying capacity in pounds: Strength score x 15. */
  capacity: number;
}

export interface EquipmentResult {
  /** What is worn, as the conditions of features read it. */
  armor: ArmorState;
  armorClass: ArmorClassResult;
  attacks: AttackResult[];
  load: LoadResult;
}

interface Context {
  character: Character;
  index: PackIndex;
  abilities: Record<Ability, AbilityResult>;
  /** Held proficiencies as `category:target` keys. */
  held: Set<string>;
  proficiencyBonus: number;
  /** Every effect in force with its source: features and choices add to armor class and attacks. */
  sourced: SourcedEffect[];
  /** The level that counts for what an entry gives: its class's, or the whole character's. */
  levelOf: (source: string) => number;
  warnings: Warning[];
  /** The ability of each class that casts spells. */
  spellAbilities: Ability[];
}

const isProficient = (held: Set<string>, keys: string[]) => keys.some((k) => held.has(k));

export function proficiencyKeys(proficiencies: Record<ProficiencyCategory, string[]>): Set<string> {
  return new Set(
    Object.entries(proficiencies).flatMap(([category, targets]) =>
      targets.map((target) => `${category}:${target}`),
    ),
  );
}

function armorStateOf(ctx: Context): ArmorState {
  const items = ctx.character.inventory
    .filter((i) => i.equipped)
    .flatMap((item) => {
      const entry = ctx.index.get(item.itemId);
      const armor = entry && itemData(entry).armor;
      return armor ? [armor] : [];
    });
  const body = items.find((a) => a.category !== "shield");
  return {
    wearing: body !== undefined,
    heavy: body?.category === "heavy",
    shield: items.some((a) => a.category === "shield"),
  };
}

function deriveArmorClass(ctx: Context, state: ArmorState): ArmorClassResult {
  const { character, index, abilities, held, warnings } = ctx;
  const equipped = character.inventory.filter((i) => i.equipped);
  const armors = equipped.flatMap((item) => {
    const entry = index.get(item.itemId);
    const armor = entry && itemData(entry).armor;
    return armor ? [{ itemId: item.itemId, armor }] : [];
  });
  const bodies = armors.filter((a) => a.armor.category !== "shield");
  const shields = armors.filter((a) => a.armor.category === "shield");
  if (bodies.length > 1) warn(warnings, "multipleArmor");
  if (shields.length > 1) warn(warnings, "multipleShields");

  const dex = abilities.dex.modifier;
  const parts: ArmorClassResult["parts"] = [];
  const body = bodies[0];
  if (body) {
    const { armor } = body;
    parts.push({ source: "armor", value: armor.base });
    if (armor.dexBonus) {
      parts.push({
        source: "dex",
        value: Math.min(dex, armor.maxDexBonus ?? Number.POSITIVE_INFINITY),
      });
    }
  } else {
    // Without armor: 10 + Dexterity, or the better of the formulas that features give (a
    // barbarian's Constitution, a monk's Wisdom, a draconic sorcerer's scales).
    type Formula = { base: number; bonus: number; feature: string; noDex: boolean };
    const total = (f: Formula) => f.base + f.bonus + (f.noDex ? 0 : dex);
    let formula: Formula | undefined;
    for (const { effect, source } of ctx.sourced) {
      if (effect.type !== "unarmoredDefense" || (shields.length > 0 && !effect.shield)) continue;
      const bonus = effect.add.reduce((sum, a) => sum + abilities[a].modifier, 0);
      const candidate = { base: effect.base, bonus, feature: source, noDex: effect.noDex === true };
      if (!formula || total(candidate) > total(formula)) formula = candidate;
    }
    if (formula && total(formula) > 10 + dex) {
      parts.push({ source: "base", value: formula.base });
      if (!formula.noDex) parts.push({ source: "dex", value: dex });
      if (formula.bonus !== 0)
        parts.push({ source: "feature", value: formula.bonus, feature: formula.feature });
    } else {
      parts.push({ source: "base", value: 10 }, { source: "dex", value: dex });
    }
  }
  const shield = shields[0];
  if (shield) parts.push({ source: "shield", value: shield.armor.base });
  for (const m of appliedModifiers(ctx.sourced, "ac", {
    armor: state,
    levelOf: ctx.levelOf,
    abilityModifier: (a) => abilities[a].modifier,
    proficiencyBonus: ctx.proficiencyBonus,
  }))
    parts.push({ source: "feature", value: m.value, feature: m.source });

  for (const { itemId, armor } of armors) {
    if (abilities.str.score < armor.strengthMinimum)
      warn(warnings, "strengthMinimum", { item: itemId, minimum: armor.strengthMinimum });
    if (!isProficient(held, armor.proficiency)) warn(warnings, "notProficient", { item: itemId });
  }

  const computed = parts.reduce((sum, p) => sum + p.value, 0);
  const override = ctx.character.overrides.ac;
  const overridden = typeof override === "number";
  return {
    value: overridden ? override : computed,
    overridden,
    stealthDisadvantage: armors.some((a) => a.armor.stealthDisadvantage),
    parts,
  };
}

/** Shillelagh works on a club or a quarterstaff. */
export const takesShillelagh = (itemId: string) => /\/(club|quarterstaff)$/.test(itemId);

/** A d4 or d6 becomes a d8; anything bigger stays. */
function shillelaghDice(dice: string): string {
  const m = dice.match(/^1d(\d+)$/);
  return m && Number(m[1]) < 8 ? "1d8" : dice;
}

function deriveAttacks(ctx: Context, armor: ArmorState): AttackResult[] {
  const { character, index, abilities, held, proficiencyBonus } = ctx;
  const attacks: AttackResult[] = [];
  const heldWeapons = character.inventory.filter((i) => {
    const entry = i.equipped ? index.get(i.itemId) : undefined;
    return Boolean(entry && itemData(entry).weapon);
  }).length;
  for (const item of character.inventory) {
    if (!item.equipped) continue;
    const entry = index.get(item.itemId);
    const weapon = entry && itemData(entry).weapon;
    if (!weapon) continue;

    const finesse = weapon.properties.some((p) => p.endsWith("/finesse"));
    let ability: Ability =
      weapon.kind === "ranged"
        ? "dex"
        : finesse && abilities.dex.modifier > abilities.str.modifier
          ? "dex"
          : "str";
    const proficient = isProficient(held, weapon.proficiency);
    const enchanted = item.enchantment ? index.get(item.enchantment) : undefined;
    const enhancement = Math.max(
      item.bonus ?? 0,
      enchanted ? (itemData(enchanted).enhancement ?? 0) : 0,
    );
    const shillelagh = item.shillelagh === true && takesShillelagh(item.itemId);
    const magical =
      shillelagh ||
      item.magical === true ||
      enchanted !== undefined ||
      enhancement > 0 ||
      Boolean(itemData(entry).rarity);
    // Features that let the weapon use another ability: the best one that applies wins.
    let abilityFrom: string | undefined;
    for (const { effect, source } of ctx.sourced) {
      if (effect.type !== "weaponAbility") continue;
      if (effect.proficient && !proficient) continue;
      if (effect.when === "oneHanded" && weapon.properties.some((p) => p.endsWith("/two-handed")))
        continue;
      if (effect.when === "magic" && !magical) continue;
      if (abilities[effect.ability].modifier > abilities[ability].modifier) {
        ability = effect.ability;
        abilityFrom = source;
      }
    }
    if (shillelagh) {
      for (const a of ctx.spellAbilities) {
        if (abilities[a].modifier > abilities[ability].modifier) {
          ability = a;
          abilityFrom = "srd51:spell/shillelagh";
        }
      }
    }
    const modifier = abilities[ability].modifier;
    const grip = (twoHanded: boolean) => ({
      armor,
      levelOf: ctx.levelOf,
      weapon: { kind: weapon.kind, twoHanded, held: heldWeapons },
    });
    const alwaysTwoHanded = weapon.properties.some((p) => p.endsWith("/two-handed"));
    const toHit = appliedModifiers(ctx.sourced, "attack", grip(alwaysTwoHanded));
    const oneHand = appliedModifiers(ctx.sourced, "damage", grip(alwaysTwoHanded));
    const twoHands = appliedModifiers(ctx.sourced, "damage", grip(true));
    const withBonus = (
      d: { dice: string; type: string },
      extra: AppliedModifier[],
    ): DamageResult => ({
      dice: d.dice,
      bonus: modifier + enhancement + total(extra),
      type: d.type,
    });
    const applied = [...toHit, ...oneHand];
    attacks.push({
      itemId: item.itemId,
      ability,
      ...(abilityFrom && { abilityFrom }),
      ...(shillelagh && { shillelagh }),
      ranged: weapon.kind === "ranged",
      magical,
      enhancement,
      ...(item.enchantment && enchanted && { enchantment: item.enchantment }),
      attackBonus: modifier + enhancement + (proficient ? proficiencyBonus : 0) + total(toHit),
      proficient,
      ...(weapon.damage && {
        damage: withBonus(
          shillelagh
            ? { ...weapon.damage, dice: shillelaghDice(weapon.damage.dice) }
            : weapon.damage,
          oneHand,
        ),
      }),
      ...(weapon.twoHandedDamage && {
        twoHandedDamage: withBonus(weapon.twoHandedDamage, twoHands),
      }),
      properties: weapon.properties,
      range: weapon.range,
      ...(applied.length > 0 && { modifiers: applied }),
    });
  }
  return attacks;
}

function deriveLoad(ctx: Context): LoadResult {
  let carried = 0;
  for (const item of ctx.character.inventory) {
    const entry = ctx.index.get(item.itemId);
    if (!entry) {
      // An item of the player's own weighs what they said; any other unknown one is a problem.
      if (item.custom) carried += (item.custom.weight ?? 0) * item.quantity;
      else warn(ctx.warnings, "unknownEntry", { id: item.itemId });
      continue;
    }
    carried += (itemData(entry).weight ?? 0) * item.quantity;
  }
  carried += coinWeight(ctx.character.coins);
  return { carried, capacity: ctx.abilities.str.score * 15 };
}

export function deriveEquipment(ctx: Context): EquipmentResult {
  const armor = armorStateOf(ctx);
  return {
    armor,
    armorClass: deriveArmorClass(ctx, armor),
    attacks: deriveAttacks(ctx, armor),
    load: deriveLoad(ctx),
  };
}
