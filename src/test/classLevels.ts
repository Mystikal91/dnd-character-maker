import type { Entry } from "../data/schema";
import { createCharacter } from "../engine/character";
import { deriveSheet } from "../engine/derive";

/**
 * A walk through every class and subclass of an index, level 1 to 20, that says what the sheet
 * gets wrong against the class's own table: the features that should have arrived and the ones
 * that arrived too early, the proficiency bonus, the spell slots and the counters that the table
 * gives (rage, ki, sorcery points, channel divinity, action surge). It returns the problems as
 * lines of text, none when all is as the table says. Used for the SRD and for the whole of Aurora.
 */

interface Level {
  level: number;
  features?: string[];
  spellSlots?: number[];
  classSpecific?: Record<string, unknown>;
}

const levelsOf = (entry: Entry): Level[] => (entry.data.levels as Level[] | undefined) ?? [];

/** The feature ids a class or subclass gives up to a level, and the ones it gives only after it. */
function featuresBy(levels: Level[], level: number): { due: Set<string>; later: Set<string> } {
  const due = new Set<string>();
  for (const l of levels) if (l.level <= level) for (const f of l.features ?? []) due.add(f);
  const later = new Set<string>();
  for (const l of levels)
    if (l.level > level) for (const f of l.features ?? []) if (!due.has(f)) later.add(f);
  return { due, later };
}

/** Counters the SRD classes get from the class table: the resource kind and the table key. */
const COUNTERS: Record<string, [kind: string, key: string][]> = {
  barbarian: [["rage", "rageCount"]],
  cleric: [["channelDivinity", "channelDivinityCharges"]],
  fighter: [
    ["actionSurge", "actionSurges"],
    ["indomitable", "indomitableUses"],
  ],
  monk: [["ki", "kiPoints"]],
  sorcerer: [["sorceryPoints", "sorceryPoints"]],
};

export interface ClassLevelAudit {
  problems: string[];
  /** How many class-or-subclass-at-a-level sheets were checked, to show the walk is not empty. */
  sheets: number;
}

export function auditClassLevels(
  index: Map<string, Entry>,
  options: { classes?: (e: Entry) => boolean; subclasses?: (e: Entry) => boolean } = {},
): ClassLevelAudit {
  const problems: string[] = [];
  let sheets = 0;
  const all = [...index.values()];
  const classes = all.filter((e) => e.kind === "class");
  const subclasses = all.filter((e) => e.kind === "subclass" && (options.subclasses?.(e) ?? true));
  const wanted = (e: Entry) => options.classes?.(e) ?? true;

  const check = (cls: Entry, sub: Entry | undefined) => {
    const label = sub ? `${sub.id}` : cls.id;
    const classLevels = levelsOf(cls);
    const subLevels = sub ? levelsOf(sub) : [];
    for (let level = 1; level <= 20; level++) {
      const where = `${label} L${level}`;
      sheets++;
      const c = createCharacter("srd51");
      c.choices.species = "srd51:species/human";
      c.abilityBase = { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 14 };
      c.classes = [{ classId: cls.id, level, ...(sub && { subclassId: sub.id }) }];
      let sheet: ReturnType<typeof deriveSheet>;
      try {
        sheet = deriveSheet(c, index);
      } catch (error) {
        problems.push(`${where}: the sheet cannot be derived (${(error as Error).message})`);
        continue;
      }
      const have = new Set(sheet.features);

      const expectedBonus = 2 + Math.floor((level - 1) / 4);
      if (sheet.proficiencyBonus !== expectedBonus)
        problems.push(
          `${where}: proficiency bonus ${sheet.proficiencyBonus}, table ${expectedBonus}`,
        );

      const own = featuresBy(classLevels, level);
      const subOwn = featuresBy(subLevels, level);
      for (const f of [...own.due, ...subOwn.due])
        if (index.has(f) && !have.has(f)) problems.push(`${where}: missing feature ${f}`);
      for (const f of [...own.later, ...subOwn.later])
        if (have.has(f)) problems.push(`${where}: feature ${f} arrives too early`);

      const row = classLevels.find((l) => l.level === level);
      const startsAt = (cls.data.spellcasting as { startsAtLevel?: number } | undefined)
        ?.startsAtLevel;
      const isWarlock = cls.id.endsWith("/warlock");
      if (row?.spellSlots && startsAt !== undefined && level >= startsAt && !isWarlock) {
        const expected = row.spellSlots.join(",");
        const got = sheet.spellSlots.slice(0, 9).join(",");
        if (got !== expected && row.spellSlots.some((n) => n > 0))
          problems.push(`${where}: spell slots ${got}, table ${expected}`);
      }

      for (const [kind, key] of COUNTERS[cls.id.split("/")[1] ?? ""] ?? []) {
        const want = Number(row?.classSpecific?.[key] ?? 0);
        const res = sheet.resources.find((r) => r.kind === kind && r.classId === cls.id);
        const got = res ? (res.unlimited ? 99 : res.max) : 0;
        if (Math.min(want, 99) !== got)
          problems.push(`${where}: ${kind} ${got}, table ${Math.min(want, 99)}`);
      }
    }
  };

  for (const cls of classes) {
    if (wanted(cls)) check(cls, undefined);
    for (const sub of subclasses.filter((s) => s.parent === cls.id)) check(cls, sub);
  }
  return { problems, sheets };
}
