import { ui } from "../../i18n/ui";
import type { UiKey } from "../../i18n/ui";
import { distance } from "../../i18n/units";

interface SpellData {
  attackType?: string;
  damage?: {
    damageType?: { index: string };
    damageAtSlotLevel?: Record<string, string>;
    damageAtCharacterLevel?: Record<string, string>;
  }[];
  healAtSlotLevel?: Record<string, string>;
  dc?: { dcType: { index: string }; dcSuccess?: string };
  areaOfEffect?: { type: string; size: number };
}

/** "8d6 (14d6 with a level 9 slot)": what a spell does at first and how far it grows. */
function scaled(table: Record<string, string>, byCharacter: boolean): string {
  const levels = Object.keys(table).sort((a, b) => Number(a) - Number(b));
  const first = levels[0];
  const last = levels[levels.length - 1];
  if (first === undefined || last === undefined) return "";
  const from = table[first] ?? "";
  const to = table[last] ?? "";
  if (from === to) return from;
  const note = ui(byCharacter ? "spells.atCharacterLevel" : "spells.atSlotLevel", { level: last });
  return `${from} (${to} ${note})`;
}

/** Attack, damage, healing, saving throw and area of a spell, as rows for its details (SRD data). */
export function spellFacts(
  data: SpellData,
  abilityName: (index: string) => string,
): [string, string][] {
  const rows: [string, string][] = [];
  if (data.attackType)
    rows.push([
      ui("spells.attack"),
      ui(data.attackType === "melee" ? "spells.attackMelee" : "spells.attackRanged"),
    ]);
  for (const part of data.damage ?? []) {
    const table = part.damageAtSlotLevel ?? part.damageAtCharacterLevel;
    if (!table) continue;
    const type = part.damageType?.index;
    const typeName = type ? ui(`hb.o.${type}` as UiKey).toLowerCase() : "";
    rows.push([
      ui("spells.damage"),
      `${scaled(table, !part.damageAtSlotLevel).replaceAll("MOD", ui("spells.mod"))}${typeName ? ` ${typeName}` : ""}`,
    ]);
  }
  if (data.healAtSlotLevel)
    rows.push([
      ui("spells.healing"),
      scaled(data.healAtSlotLevel, false).replaceAll("MOD", ui("spells.mod")),
    ]);
  if (data.dc) {
    const success = data.dc.dcSuccess;
    const effect =
      success === "half" ? ui("spells.saveHalf") : success === "none" ? ui("spells.saveNone") : "";
    rows.push([
      ui("spells.save"),
      `${abilityName(data.dc.dcType.index)}${effect ? ` · ${effect}` : ""}`,
    ]);
  }
  if (data.areaOfEffect) {
    const { type, size } = data.areaOfEffect;
    rows.push([ui("spells.area"), `${ui(`spells.area.${type}` as UiKey)} ${distance(size)}`]);
  }
  return rows;
}
