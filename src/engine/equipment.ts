import { itemData } from "../data/items";
import type { Ability, ProficiencyCategory } from "../data/schema";
import type { Character } from "./character";
import type { AbilityResult, PackIndex } from "./derive";
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
}

export interface ArmorClassResult {
  value: number;
  overridden: boolean;
  stealthDisadvantage: boolean;
  /** What the value is made of, for display. Sources are keys, not text. */
  parts: { source: "base" | "armor" | "dex" | "shield"; value: number }[];
}

export interface LoadResult {
  /** Carried weight in pounds. */
  carried: number;
  /** Carrying capacity in pounds: Strength score x 15. */
  capacity: number;
}

export interface EquipmentResult {
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

function deriveArmorClass(ctx: Context): ArmorClassResult {
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
    parts.push({ source: "base", value: 10 }, { source: "dex", value: dex });
  }
  const shield = shields[0];
  if (shield) parts.push({ source: "shield", value: shield.armor.base });

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

function deriveAttacks(ctx: Context): AttackResult[] {
  const { character, index, abilities, held, proficiencyBonus } = ctx;
  const attacks: AttackResult[] = [];
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
    const withBonus = (d: { dice: string; type: string }): DamageResult => ({
      dice: d.dice,
      bonus: modifier,
      type: d.type,
    });
    attacks.push({
      itemId: item.itemId,
      ability,
      attackBonus: modifier + (proficient ? proficiencyBonus : 0),
      proficient,
      ...(weapon.damage && { damage: withBonus(weapon.damage) }),
      ...(weapon.twoHandedDamage && { twoHandedDamage: withBonus(weapon.twoHandedDamage) }),
      properties: weapon.properties,
      range: weapon.range,
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
  return {
    armorClass: deriveArmorClass(ctx),
    attacks: deriveAttacks(ctx),
    load: deriveLoad(ctx),
  };
}
