import { ABILITIES, type Ability } from "../data/schema";
import type { AbilityResult, PackIndex } from "./derive";
import { OVERRIDE, type Overrides, numberOverride } from "./overrides";

export interface CheckResult {
  bonus: number;
  proficient: boolean;
}

export interface SkillResult extends CheckResult {
  id: string;
  ability: Ability;
}

export interface ChecksResult {
  saves: Record<Ability, CheckResult>;
  skills: SkillResult[];
  /** 10 + Perception bonus; 10 + Wisdom modifier if the ruleset has no Perception skill. */
  passivePerception: number;
}

interface ChecksInput {
  index: PackIndex;
  ruleset: string;
  abilities: Record<Ability, AbilityResult>;
  /** Held proficiencies as `category:target` keys. */
  held: Set<string>;
  proficiencyBonus: number;
  /** Free edit values: a forced bonus replaces the calculated one. */
  overrides: Overrides;
}

export function deriveChecks({
  index,
  ruleset,
  abilities,
  held,
  proficiencyBonus,
  overrides,
}: ChecksInput): ChecksResult {
  const saves = {} as Record<Ability, CheckResult>;
  for (const ability of ABILITIES) {
    const proficient = held.has(`save:${ability}`);
    saves[ability] = {
      bonus:
        numberOverride(overrides, OVERRIDE.save(ability)) ??
        abilities[ability].modifier + (proficient ? proficiencyBonus : 0),
      proficient,
    };
  }

  const skills: SkillResult[] = [];
  for (const entry of index.values()) {
    if (entry.kind !== "skill" || !entry.id.startsWith(`${ruleset}:`)) continue;
    const ability = entry.data.ability as Ability;
    const slug = entry.id.split("/")[1] ?? "";
    const proficient = held.has(`skill:${slug}`);
    skills.push({
      id: entry.id,
      ability,
      bonus:
        numberOverride(overrides, OVERRIDE.skill(slug)) ??
        abilities[ability].modifier + (proficient ? proficiencyBonus : 0),
      proficient,
    });
  }

  const perception = skills.find((s) => s.id.endsWith("/perception"));
  return {
    saves,
    skills,
    passivePerception: 10 + (perception?.bonus ?? abilities.wis.modifier),
  };
}
