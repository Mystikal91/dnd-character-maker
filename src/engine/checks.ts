import { ABILITIES, type Ability } from "../data/schema";
import type { AbilityResult, PackIndex } from "./derive";

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
}

export function deriveChecks({
  index,
  ruleset,
  abilities,
  held,
  proficiencyBonus,
}: ChecksInput): ChecksResult {
  const saves = {} as Record<Ability, CheckResult>;
  for (const ability of ABILITIES) {
    const proficient = held.has(`save:${ability}`);
    saves[ability] = {
      bonus: abilities[ability].modifier + (proficient ? proficiencyBonus : 0),
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
      bonus: abilities[ability].modifier + (proficient ? proficiencyBonus : 0),
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
