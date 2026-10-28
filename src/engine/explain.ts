import { itemData } from "../data/items";
import type { Ability } from "../data/schema";
import type { Character } from "./character";
import type { DerivedSheet, PackIndex } from "./derive";
import { OVERRIDE } from "./overrides";

/** A number of the sheet that can be taken apart into what it is made of. */
export type ExplainTarget =
  | { kind: "ac" }
  | { kind: "initiative" }
  | { kind: "save"; ability: Ability }
  | { kind: "skill"; id: string }
  | { kind: "attack"; itemId: string };

/** What a line is: the sheet words it, so this module needs no texts. */
export type ExplainPart =
  | "base"
  | "armor"
  | "shield"
  | "ability"
  | "feature"
  | "proficiency"
  | "expertise"
  | "halfProficiency"
  | "enhancement"
  | "other";

export interface ExplainLine {
  part: ExplainPart;
  value: number;
  /** An entry id (armor, shield, feature) or an ability, for the words of the line. */
  ref?: string;
}

export interface Explained {
  /** The number as the sheet shows it. */
  total: number;
  /** A value forced in Free edit: the lines say what it would have been. */
  forced: boolean;
  lines: ExplainLine[];
}

/** Whatever the lines do not account for, so they always add up to the number shown. */
function withRest(total: number, lines: ExplainLine[], rest: ExplainPart = "other"): ExplainLine[] {
  const known = lines.reduce((sum, l) => sum + l.value, 0);
  return known === total ? lines : [...lines, { part: rest, value: total - known }];
}

/** Takes a number of the sheet apart: what each part adds, and where it comes from. */
export function explain(
  target: ExplainTarget,
  sheet: DerivedSheet,
  character: Character,
  index: PackIndex,
): Explained | undefined {
  const pb = sheet.proficiencyBonus;
  switch (target.kind) {
    case "ac": {
      const armored = character.inventory
        .filter((i) => i.equipped)
        .flatMap((i) => {
          const entry = index.get(i.itemId);
          const armor = entry && itemData(entry).armor;
          return armor ? [{ id: i.itemId, shield: armor.category === "shield" }] : [];
        });
      const body = armored.find((a) => !a.shield)?.id;
      const shield = armored.find((a) => a.shield)?.id;
      const lines: ExplainLine[] = sheet.armorClass.parts.map((p) => {
        if (p.source === "armor") return { part: "armor", value: p.value, ref: body };
        if (p.source === "shield") return { part: "shield", value: p.value, ref: shield };
        if (p.source === "dex") return { part: "ability", value: p.value, ref: "dex" };
        if (p.source === "feature") return { part: "feature", value: p.value, ref: p.feature };
        return { part: "base", value: p.value };
      });
      return { total: sheet.armorClass.value, forced: sheet.armorClass.overridden, lines };
    }

    case "initiative": {
      const dex = sheet.abilities.dex.modifier;
      const bonuses = sheet.bonuses.filter((b) => b.target === "initiative");
      const lines: ExplainLine[] = [
        { part: "ability", value: dex, ref: "dex" },
        ...bonuses.map((b) => ({ part: "feature" as const, value: b.value, ref: b.source })),
      ];
      const forced = typeof character.overrides[OVERRIDE.initiative] === "number";
      return {
        total: sheet.initiative,
        forced,
        lines: forced ? lines : withRest(sheet.initiative, lines, "halfProficiency"),
      };
    }

    case "save": {
      const save = sheet.saves[target.ability];
      const lines: ExplainLine[] = [
        { part: "ability", value: sheet.abilities[target.ability].modifier, ref: target.ability },
        ...(save.proficient ? [{ part: "proficiency" as const, value: pb }] : []),
      ];
      const forced = typeof character.overrides[OVERRIDE.save(target.ability)] === "number";
      return { total: save.bonus, forced, lines: forced ? lines : withRest(save.bonus, lines) };
    }

    case "skill": {
      const skill = sheet.skills.find((s) => s.id === target.id);
      if (!skill) return undefined;
      const mod = sheet.abilities[skill.ability].modifier;
      const lines: ExplainLine[] = [{ part: "ability", value: mod, ref: skill.ability }];
      const rest = skill.bonus - mod;
      if (skill.proficient) {
        lines.push({ part: "proficiency", value: pb });
        if (rest === 2 * pb) lines.push({ part: "expertise", value: pb });
      } else if (rest > 0) {
        lines.push({ part: "halfProficiency", value: rest });
      }
      const slug = target.id.split("/")[1] ?? "";
      const forced = typeof character.overrides[OVERRIDE.skill(slug)] === "number";
      return { total: skill.bonus, forced, lines: forced ? lines : withRest(skill.bonus, lines) };
    }

    case "attack": {
      const attack = sheet.attacks.find((a) => a.itemId === target.itemId);
      if (!attack) return undefined;
      const mods = (attack.modifiers ?? []).filter((m) => m.target === "attack");
      const lines: ExplainLine[] = [
        ...(attack.proficient ? [{ part: "proficiency" as const, value: pb }] : []),
        ...(attack.enhancement > 0
          ? [{ part: "enhancement" as const, value: attack.enhancement }]
          : []),
        ...mods.map((m) => ({ part: "feature" as const, value: m.value, ref: m.source })),
      ];
      const ability = attack.attackBonus - lines.reduce((sum, l) => sum + l.value, 0);
      return {
        total: attack.attackBonus,
        forced: false,
        lines: [{ part: "ability", value: ability }, ...lines],
      };
    }
  }
}
