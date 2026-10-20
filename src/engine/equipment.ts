import { itemData } from "../data/items";
import type { Ability, ProficiencyCategory } from "../data/schema";
import type { Character } from "./character";
import type { SourcedEffect } from "./choices";
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
  warnings: Warning[];
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
    let formula: { base: number; bonus: number; feature: string } | undefined;
    for (const { effect, source } of ctx.sourced) {
      if (effect.type !== "unarmoredDefense" || (shields.length > 0 && !effect.shield)) continue;
      const bonus = effect.add.reduce((sum, a) => sum + abilities[a].modifier, 0);
      const better = !formula || effect.base + bonus > formula.base + formula.bonus;
      if (better) formula = { base: effect.base, bonus, feature: source };
    }
    if (formula && formula.base + formula.bonus > 10) {
      parts.push({ source: "base", value: formula.base }, { source: "dex", value: dex });
      if (formula.bonus !== 0)
        parts.push({ source: "feature", value: formula.bonus, feature: formula.feature });
    } else {
      parts.push({ source: "base", value: 10 }, { source: "dex", value: dex });
    }
  }
  const shield = shields[0];
  if (shield) parts.push({ source: "shield", value: shield.armor.base });
  for (const m of appliedModifiers(ctx.sourced, "ac", { armor: state }))
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
    const ability: Ability =
      weapon.kind === "ranged"
        ? "dex"
        : finesse && abilities.dex.modifier > abilities.str.modifier
          ? "dex"
          : "str";
    const modifier = abilities[ability].modifier;
    const proficient = isProficient(held, weapon.proficiency);
    const grip = (twoHanded: boolean) => ({
      armor,
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
      bonus: modifier + total(extra),
      type: d.type,
    });
    const applied = [...toHit, ...oneHand];
    attacks.push({
      itemId: item.itemId,
      ability,
      attackBonus: modifier + (proficient ? proficiencyBonus : 0) + total(toHit),
      proficient,
      ...(weapon.damage && { damage: withBonus(weapon.damage, oneHand) }),
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
      warn(ctx.warnings, "unknownEntry", { id: item.itemId });
      continue;
    }
    carried += (itemData(entry).weight ?? 0) * item.quantity;
  }
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
