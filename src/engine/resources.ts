import type { ClassData } from "../data/progression";
import type { Ability } from "../data/schema";

export type ResourceRecovery = "short" | "long";

/**
 * Something a class lets the character use a limited number of times between rests.
 * `kind` names it for the interface (translated there); `id` is stable and unique, so the
 * uses spent can be saved under it.
 */
export interface ClassResource {
  id: string;
  kind: string;
  classId: string;
  max: number;
  recovery: ResourceRecovery;
  /** Counted in points (ki, lay on hands) rather than a few uses to tick off. */
  pool?: boolean;
  /** No limit at this level (a barbarian's rages at level 20). */
  unlimited?: boolean;
  /** A level of spell or similar number the label needs. */
  level?: number;
}

/** A class number worth showing during play: a die, a bonus. */
export interface ClassFact {
  kind: string;
  params: Record<string, string | number>;
}

/**
 * Damage that a class adds to its attacks, with when it applies written out in the interface:
 * a die once per turn (sneak attack), a bonus while raging, extra dice on a critical hit, a
 * smite that spends a slot, and the die that martial arts uses for unarmed strikes.
 */
export type ExtraDamage =
  | { kind: "sneakAttack"; dice: string }
  | { kind: "rage"; bonus: number }
  | { kind: "brutalCritical"; dice: number }
  | { kind: "divineSmite" }
  | { kind: "martialArts"; dice: string };

interface Input {
  classId: string;
  level: number;
  data: ClassData;
  modifier: (ability: Ability) => number;
}

const slug = (classId: string) => classId.split("/")[1] ?? classId;

const fraction = (cr: number) => (cr === 0.25 ? "1/4" : cr === 0.5 ? "1/2" : String(cr));

/** The limited-use features of one class at its level, and the numbers that go with them. */
export function classResources(input: Input): {
  resources: ClassResource[];
  facts: ClassFact[];
  extras: ExtraDamage[];
} {
  const { classId, level, data, modifier } = input;
  const row = data.levels.find((l) => l.level === level)?.classSpecific ?? {};
  const num = (key: string) => (typeof row[key] === "number" ? (row[key] as number) : 0);
  const resources: ClassResource[] = [];
  const facts: ClassFact[] = [];
  const extras: ExtraDamage[] = [];
  const add = (
    kind: string,
    max: number,
    recovery: ResourceRecovery,
    extra: Partial<ClassResource> = {},
  ) => {
    if (max > 0)
      resources.push({ id: `${kind}:${slug(classId)}`, kind, classId, max, recovery, ...extra });
  };

  switch (slug(classId)) {
    case "barbarian": {
      const rages = num("rageCount");
      // The data writes "unlimited" as a huge number.
      add("rage", Math.min(rages, 99), "long", { unlimited: rages >= 99 });
      if (num("rageDamageBonus") > 0) {
        facts.push({ kind: "rageDamage", params: { n: num("rageDamageBonus") } });
        extras.push({ kind: "rage", bonus: num("rageDamageBonus") });
      }
      if (num("brutalCriticalDice") > 0)
        extras.push({ kind: "brutalCritical", dice: num("brutalCriticalDice") });
      break;
    }
    case "bard":
      add("bardicInspiration", Math.max(1, modifier("cha")), level >= 5 ? "short" : "long");
      if (num("bardicInspirationDie") > 0)
        facts.push({ kind: "bardicDie", params: { die: num("bardicInspirationDie") } });
      break;
    case "cleric":
      add("channelDivinity", num("channelDivinityCharges"), "short");
      break;
    case "druid":
      if (level >= 2) add("wildShape", 2, "short");
      if (num("wildShapeMaxCr") > 0)
        facts.push({ kind: "wildShape", params: { cr: fraction(num("wildShapeMaxCr")) } });
      break;
    case "fighter":
      add("secondWind", 1, "short");
      add("actionSurge", num("actionSurges"), "short");
      add("indomitable", num("indomitableUses"), "long");
      break;
    case "monk": {
      add("ki", num("kiPoints"), "short", { pool: true });
      const art = row.martialArts as { diceCount?: number; diceValue?: number } | undefined;
      if (art?.diceValue) {
        const dice = `${art.diceCount ?? 1}d${art.diceValue}`;
        facts.push({ kind: "martialArts", params: { dice } });
        extras.push({ kind: "martialArts", dice });
      }
      break;
    }
    case "paladin":
      add("layOnHands", 5 * level, "long", { pool: true });
      add("divineSense", 1 + modifier("cha"), "long");
      if (level >= 2) extras.push({ kind: "divineSmite" });
      if (level >= 3) add("channelDivinity", 1, "short");
      if (level >= 14) add("cleansingTouch", Math.max(1, modifier("cha")), "long");
      break;
    case "rogue": {
      const sneak = row.sneakAttack as { diceCount?: number; diceValue?: number } | undefined;
      if (sneak?.diceCount) {
        const dice = `${sneak.diceCount}d${sneak.diceValue ?? 6}`;
        facts.push({ kind: "sneakAttack", params: { dice } });
        extras.push({ kind: "sneakAttack", dice });
      }
      break;
    }
    case "sorcerer":
      add("sorceryPoints", num("sorceryPoints"), "long", { pool: true });
      break;
    case "warlock":
      for (const spellLevel of [6, 7, 8, 9]) {
        if (num(`mysticArcanumLevel_${spellLevel}`) > 0) {
          resources.push({
            id: `mysticArcanum${spellLevel}:${slug(classId)}`,
            kind: "mysticArcanum",
            classId,
            max: 1,
            recovery: "long",
            level: spellLevel,
          });
        }
      }
      break;
    case "wizard":
      add("arcaneRecovery", 1, "long");
      if (num("arcaneRecoveryLevels") > 0)
        facts.push({ kind: "arcaneRecovery", params: { levels: num("arcaneRecoveryLevels") } });
      break;
  }
  return { resources, facts, extras };
}
