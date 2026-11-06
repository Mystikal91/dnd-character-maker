import { parseDice } from "./dice";

/** What the SRD data of a spell says it rolls (`attackType`, `damage`, `healAtSlotLevel`). */
/** A bonus a feature adds to the damage of spells: whom it is for is the spell, the school or the damage type. */
export interface SpellBonus {
  value: number;
  spell?: string;
  school?: string;
  damageType?: string;
  /** Added to one damage roll of the spell (the first it fits), not to every one. */
  once: boolean;
}

/** What features do to the healing of spells (see the `spellHealing` effect), the sum of all of them. */
export interface SpellHealing {
  plusSlotLevel: number;
  maxDice: boolean;
  selfPlusSlotLevel: number;
}

export interface SpellRollData {
  school?: string;
  attackType?: string;
  damage?: {
    damageType?: { index: string };
    damageAtSlotLevel?: Record<string, string>;
    damageAtCharacterLevel?: Record<string, string>;
  }[];
  healAtSlotLevel?: Record<string, string>;
  dc?: { dcType: { index: string }; dcSuccess?: string };
}

export interface SpellRolls {
  /** The spell is cast with an attack roll. */
  attack: boolean;
  damage: { type: string; dice: string }[];
  /** The dice of the healing, with the spellcasting modifier already in. */
  heal?: string;
  /** With the highest number on every die (Supreme Healing): the total of the healing. */
  healFixed?: number;
  /** What the caster is healed too when the healing is for someone else (Blessed Healer). */
  selfHeal?: number;
  /** The ability the target saves with. */
  save?: string;
  /** The slot levels a bigger one changes something for: the dice differ from the base level. */
  scalesBySlot: boolean;
}

/** The step of a table keyed by level that applies at `level`: the highest one not above it. */
function stepAt(table: Record<string, string>, level: number): string | undefined {
  const keys = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b);
  const first = keys[0];
  if (first === undefined) return undefined;
  const key = keys.filter((k) => k <= level).pop() ?? first;
  return table[String(key)];
}

/** The most a dice expression can give: every die on its highest face. */
function highest(text: string): number | undefined {
  const parsed = parseDice(text);
  return parsed
    ? parsed.terms.reduce((sum, t) => sum + t.count * t.sides, 0) + parsed.modifier
    : undefined;
}

/** `1d8 + MOD` with the modifier worked out, written for the dice roller (`1d8+3`). */
function withModifier(text: string, modifier: number): string {
  const worked = text.replace(
    /\s*\+\s*MOD/gi,
    modifier === 0 ? "" : modifier > 0 ? `+${modifier}` : `${modifier}`,
  );
  return worked.replace(/\s+/g, "");
}

/**
 * What a spell rolls when cast with a slot of `slotLevel` by a character of `characterLevel`:
 * the dice come from the table of the spell for that slot (or, for a cantrip, for that level).
 */
export function spellRolls(
  data: SpellRollData,
  options: {
    slotLevel: number;
    characterLevel: number;
    modifier: number;
    /** What features add to the damage, and the id of this spell to tell which of them are for it. */
    bonuses?: SpellBonus[];
    spellId?: string;
    /** What features do to healing, for a spell of 1st level or higher. */
    healing?: SpellHealing;
  },
): SpellRolls {
  const damage: SpellRolls["damage"] = [];
  let scalesBySlot = false;
  const spent = new Set<SpellBonus>();
  for (const part of data.damage ?? []) {
    const bySlot = part.damageAtSlotLevel;
    const table = bySlot ?? part.damageAtCharacterLevel;
    const level = bySlot ? options.slotLevel : options.characterLevel;
    const dice = table && stepAt(table, level);
    if (!dice) continue;
    if (bySlot && new Set(Object.values(bySlot)).size > 1) scalesBySlot = true;
    const worked = withModifier(dice, options.modifier);
    const type = part.damageType?.index ?? "";
    // What a feature adds to the damage (Agonizing Blast) is one more step after the dice.
    let bonus = 0;
    for (const b of options.bonuses ?? []) {
      const fits =
        (b.spell !== undefined && b.spell === options.spellId) ||
        (b.school !== undefined && b.school === data.school) ||
        (b.damageType !== undefined && b.damageType === type);
      if (!fits || (b.once && spent.has(b))) continue;
      if (b.once) spent.add(b);
      bonus += b.value;
    }
    damage.push({
      type,
      dice: bonus === 0 ? worked : `${worked}${bonus > 0 ? "+" : ""}${bonus}`,
    });
  }
  const healTable = data.healAtSlotLevel;
  const healed = healTable && stepAt(healTable, options.slotLevel);
  if (healTable && new Set(Object.values(healTable)).size > 1) scalesBySlot = true;
  let heal = healed ? withModifier(healed, options.modifier) : undefined;
  let healFixed: number | undefined;
  let selfHeal: number | undefined;
  const h = options.healing;
  if (heal && h && options.slotLevel >= 1) {
    if (h.plusSlotLevel > 0) heal = `${heal}+${h.plusSlotLevel + options.slotLevel}`;
    if (h.maxDice) healFixed = highest(heal);
    if (h.selfPlusSlotLevel > 0) selfHeal = h.selfPlusSlotLevel + options.slotLevel;
  }
  return {
    attack: Boolean(data.attackType),
    damage,
    ...(heal && { heal }),
    ...(healFixed !== undefined && { healFixed }),
    ...(selfHeal !== undefined && { selfHeal }),
    ...(data.dc && { save: data.dc.dcType.index }),
    scalesBySlot,
  };
}
