import { type PlayState, createPlayState } from "./character";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Current hit points: `undefined` in the saved state means full, and it never exceeds the maximum. */
export function currentHp(play: PlayState, max: number): number {
  return clamp(play.hp ?? max, 0, max);
}

export type DeathStatus = "alive" | "dying" | "stable" | "dead";

/** At 0 hit points a character is dying, until three successes make them stable or three failures kill. */
export function deathStatus(play: PlayState, max: number): DeathStatus {
  if (play.deathSaves.failures >= 3) return "dead";
  if (currentHp(play, max) > 0) return "alive";
  return play.deathSaves.successes >= 3 ? "stable" : "dying";
}

/**
 * Damage hits temporary hit points first. Damage taken at 0 hit points is a failed death save,
 * and damage that leaves 0 with at least the maximum still to spare kills outright.
 */
export function applyDamage(play: PlayState, max: number, amount: number): PlayState {
  const damage = Math.max(0, Math.floor(amount));
  if (damage === 0) return play;
  const before = currentHp(play, max);

  const absorbed = Math.min(play.tempHp, damage);
  const remaining = damage - absorbed;
  const hp = Math.max(0, before - remaining);
  const next: PlayState = { ...play, hp, tempHp: play.tempHp - absorbed };

  const overflow = remaining - before;
  if (before === 0 && remaining > 0) {
    next.deathSaves = {
      ...play.deathSaves,
      failures: Math.min(3, play.deathSaves.failures + 1),
    };
  }
  if (hp === 0 && overflow >= max) next.deathSaves = { ...next.deathSaves, failures: 3 };
  return next;
}

/** Healing raises hit points up to the maximum, and any healing from 0 ends the dying state. */
export function applyHealing(play: PlayState, max: number, amount: number): PlayState {
  const heal = Math.max(0, Math.floor(amount));
  if (heal === 0 || play.deathSaves.failures >= 3) return play;
  const before = currentHp(play, max);
  const next: PlayState = { ...play, hp: Math.min(max, before + heal) };
  if (before === 0) next.deathSaves = { successes: 0, failures: 0 };
  return next;
}

/** Temporary hit points do not stack: a new amount only replaces a smaller one. */
export function gainTempHp(play: PlayState, amount: number): PlayState {
  const gained = Math.max(0, Math.floor(amount));
  return gained > play.tempHp ? { ...play, tempHp: gained } : play;
}

/** Moves one death save pip: marks the next success or failure, or unmarks the last one. */
export function setDeathSave(
  play: PlayState,
  kind: "successes" | "failures",
  count: number,
): PlayState {
  return { ...play, deathSaves: { ...play.deathSaves, [kind]: clamp(count, 0, 3) } };
}

/** Spell slots still available at one spell level, given how many the class has. */
export function slotsLeft(play: PlayState, level: number, total: number): number {
  return Math.max(0, total - (play.slotsUsed[level - 1] ?? 0));
}

/** Sets how many slots of a level are spent, never below 0 or above the total. */
export function setSlotsUsed(
  play: PlayState,
  level: number,
  used: number,
  total: number,
): PlayState {
  const slotsUsed = [...play.slotsUsed];
  slotsUsed[level - 1] = clamp(used, 0, total);
  return { ...play, slotsUsed };
}

/** Which slot a cast used: a slot of the spell slot table, or a Pact Magic slot. */
export type CastSlot = { kind: "slot" | "pact"; level: number };

/**
 * Spends the lowest slot that can hold a spell of this level: a spell slot of the same level or
 * higher, then a Pact Magic slot. Returns undefined, and changes nothing, when none is left.
 */
export function castSpell(
  play: PlayState,
  spellLevel: number,
  spellSlots: number[],
  pact?: { level: number; count: number },
): { play: PlayState; slot: CastSlot } | undefined {
  for (let level = Math.max(1, spellLevel); level <= spellSlots.length; level++) {
    const total = spellSlots[level - 1] ?? 0;
    if (total > 0 && slotsLeft(play, level, total) > 0)
      return {
        play: setSlotsUsed(play, level, (play.slotsUsed[level - 1] ?? 0) + 1, total),
        slot: { kind: "slot", level },
      };
  }
  if (pact && pact.level >= spellLevel && pactLeft(play, pact.count) > 0)
    return {
      play: setPactUsed(play, (play.pactUsed ?? 0) + 1, pact.count),
      slot: { kind: "pact", level: pact.level },
    };
  return undefined;
}

/** Hit dice of one size that are still unspent. */
export function hitDiceLeft(play: PlayState, die: string, total: number): number {
  return Math.max(0, total - (play.hitDiceUsed[die] ?? 0));
}

/**
 * Spends one hit die: heals the roll plus the Constitution modifier (at least 0).
 * The caller rolls the die so the roll can be shown to the player.
 */
export function spendHitDie(
  play: PlayState,
  max: number,
  die: string,
  rolled: number,
  conModifier: number,
): PlayState {
  const spent: PlayState = {
    ...play,
    hitDiceUsed: { ...play.hitDiceUsed, [die]: (play.hitDiceUsed[die] ?? 0) + 1 },
  };
  return applyHealing(spent, max, Math.max(0, rolled + conModifier));
}

/** Pact Magic slots still available. */
export function pactLeft(play: PlayState, total: number): number {
  return Math.max(0, total - (play.pactUsed ?? 0));
}

/** Sets how many Pact Magic slots are spent, never below 0 or above the total. */
export function setPactUsed(play: PlayState, used: number, total: number): PlayState {
  return { ...play, pactUsed: clamp(used, 0, total) };
}

/** What a short rest gives back: a lone warlock's slots, a multiclass warlock's pact slots, or nothing. */
export type ShortRestRecovery = "all" | "pact" | "none";

/**
 * A short rest. Warlocks get their pact slots back; everyone else's slots wait for a long rest.
 * Hit dice are spent separately, one at a time, so the player can stop when healthy enough.
 */
export function shortRest(
  play: PlayState,
  recovers: ShortRestRecovery,
  /** Ids of the class resources that come back on a short rest. */
  resources: string[] = [],
): PlayState {
  // A rage lasts a minute: a short rest has ended it.
  let next = endRage(play);
  if (recovers === "all") next = { ...next, slotsUsed: next.slotsUsed.map(() => 0), pactUsed: 0 };
  else if (recovers === "pact") next = { ...next, pactUsed: 0 };
  if (resources.length > 0 && next.resourcesUsed) {
    const used = { ...next.resourcesUsed };
    for (const id of resources) delete used[id];
    next = { ...next, resourcesUsed: used };
  }
  return next;
}

/** Uses of a class resource still available. */
export function resourceLeft(play: PlayState, id: string, max: number): number {
  return Math.max(0, max - (play.resourcesUsed?.[id] ?? 0));
}

/** Sets how many uses of a class resource are spent, never below 0 or above the maximum. */
export function setResourceUsed(play: PlayState, id: string, used: number, max: number): PlayState {
  return { ...play, resourcesUsed: { ...play.resourcesUsed, [id]: clamp(used, 0, max) } };
}

/** Starts concentrating on a spell, which ends any concentration already going. */
export function startConcentration(play: PlayState, spell: string): PlayState {
  return { ...play, concentration: spell };
}

export function endConcentration(play: PlayState): PlayState {
  const { concentration: _ended, ...rest } = play;
  return rest;
}

/** The Constitution save DC to keep concentrating after taking damage: 10 or half, if higher. */
export function concentrationDc(damage: number): number {
  return Math.max(10, Math.floor(damage / 2));
}

/**
 * A long rest: full hit points, no temporary hit points, all slots back, no death saves, and
 * half of the hit dice (at least one) regained, largest dice first.
 */
export function longRest(play: PlayState, hitDice: Record<string, number>): PlayState {
  const totalDice = Object.values(hitDice).reduce((sum, n) => sum + n, 0);
  let regain = Math.max(1, Math.floor(totalDice / 2));

  const hitDiceUsed = { ...play.hitDiceUsed };
  const bySize = Object.keys(hitDiceUsed).sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)));
  for (const die of bySize) {
    const back = Math.min(regain, hitDiceUsed[die] ?? 0);
    hitDiceUsed[die] = (hitDiceUsed[die] ?? 0) - back;
    regain -= back;
  }

  return {
    ...createPlayState(),
    inspiration: play.inspiration,
    conditions: play.conditions,
    hitDiceUsed: Object.fromEntries(Object.entries(hitDiceUsed).filter(([, n]) => n > 0)),
  };
}

export function toggleCondition(play: PlayState, id: string): PlayState {
  return {
    ...play,
    conditions: play.conditions.includes(id)
      ? play.conditions.filter((c) => c !== id)
      : [...play.conditions, id],
  };
}

/** Enters a rage, spending one of its uses (unless they are unlimited, `max` of 0). */
export function enterRage(play: PlayState, resource?: { id: string; max: number }): PlayState {
  const spent = resource
    ? setResourceUsed(play, resource.id, (play.resourcesUsed?.[resource.id] ?? 0) + 1, resource.max)
    : play;
  return { ...spent, raging: true };
}

export function endRage(play: PlayState): PlayState {
  if (!play.raging) return play;
  const { raging: _over, ...rest } = play;
  return rest;
}

/** A rage ends when the barbarian is knocked unconscious. */
export function endRageIfDown(play: PlayState, max: number): PlayState {
  return play.raging && currentHp(play, max) === 0 ? endRage(play) : play;
}

/** Resistance halves the damage, rounding down. */
export const halveDamage = (amount: number): number => Math.floor(Math.max(0, amount) / 2);
