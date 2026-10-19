import type { Effect, Entry } from "../data/schema";
import { slugify } from "../import/aurora/xml";
import type { UserPackRecord } from "../storage/packs";

/** What the editor can make. Weapons, armor and gear are all `item` entries. */
export const HOMEBREW_KINDS = [
  "spell",
  "weapon",
  "armor",
  "gear",
  "language",
  "feat",
  "species",
  "background",
] as const;
export type HomebrewKind = (typeof HOMEBREW_KINDS)[number];

export const DAMAGE_TYPES = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
] as const;
export const SIZES = ["tiny", "small", "medium", "large"] as const;
export const COIN_UNITS = ["cp", "sp", "gp"] as const;
export const ABILITY_IDS = ["str", "dex", "con", "int", "wis", "cha"] as const;

/** A species trait written in the editor: it becomes a `trait` entry of its own. */
export interface DraftTrait {
  name: string;
  text: string;
}

/**
 * The editor's form for one entry. Every field is text so forms stay simple: checkboxes are
 * `"true"` or `""`, lists are ids joined by commas, and numbers are parsed when the entry is built.
 */
export interface Draft {
  kind: HomebrewKind;
  values: Record<string, string>;
  traits: DraftTrait[];
}

export const blankDraft = (kind: HomebrewKind): Draft => ({ kind, values: {}, traits: [] });

/** What the builder needs to know about the app's content. */
export interface BuildContext {
  /** Every language slug, offered by a background's language choice. */
  languages: string[];
}

const num = (s: string | undefined, fallback: number) => {
  const n = Number((s ?? "").trim());
  return (s ?? "").trim() !== "" && Number.isFinite(n) ? n : fallback;
};
const whole = (s: string | undefined, fallback: number) => Math.trunc(num(s, fallback));
const list = (s: string | undefined) => (s ? s.split(",").filter(Boolean) : []);
const on = (s: string | undefined) => s === "true";
const lines = (s: string | undefined) =>
  (s ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
const text = (s: string | undefined) => (s ?? "").trim();

type Id = Entry["id"];
const idOf = (pack: string, kind: string, slug: string) => `${pack}:${kind}/${slug}` as Id;
const packOf = (id: string) => id.split(":")[0] ?? "";
const slugOf = (id: string) => id.split("/")[1] ?? "";

interface Built {
  entries: Entry[];
  strings: Record<string, string>;
}

function cost(values: Record<string, string>) {
  const unit = COIN_UNITS.find((u) => u === values.costUnit) ?? "gp";
  return { amount: Math.max(0, num(values.costAmount, 0)), unit };
}

function itemBase(values: Record<string, string>, category: string) {
  const weight = text(values.weight) === "" ? undefined : num(values.weight, 0);
  return { category, cost: cost(values), ...(weight !== undefined && { weight }) };
}

/** Builds the entries and texts a draft stands for. `id` is the main entry's id. */
export function buildDraft(draft: Draft, id: Id, context: BuildContext): Built {
  const { values } = draft;
  const pack = packOf(id);
  const name = text(values.name) || "Unnamed";
  const strings: Record<string, string> = { [`${id}.name`]: name };
  const put = (field: string, value: string | undefined) => {
    if (text(value)) strings[`${id}.${field}`] = text(value);
  };
  put("desc", values.desc);
  const extra: Entry[] = [];
  let entry: Entry;

  switch (draft.kind) {
    case "spell": {
      put("higherLevel", values.higherLevel);
      put("castingTime", values.castingTime);
      put("range", values.range);
      put("duration", values.duration);
      put("material", values.material);
      entry = {
        id,
        kind: "spell",
        effects: [],
        data: {
          level: Math.min(9, Math.max(0, whole(values.level, 0))),
          school: text(values.school) || "evocation",
          components: [
            on(values.compV) && "V",
            on(values.compS) && "S",
            on(values.compM) && "M",
          ].filter(Boolean),
          ritual: on(values.ritual),
          concentration: on(values.concentration),
          classes: list(values.classes),
        },
      };
      break;
    }
    case "weapon": {
      const category = values.wcategory === "martial" ? "martial" : "simple";
      const kind = values.wkind === "ranged" ? "ranged" : "melee";
      const properties = list(values.properties);
      const type = text(values.damageType) || "slashing";
      const dice = /^\d+d\d+$/.test(text(values.damage)) ? text(values.damage) : "1d4";
      const versatile = /^\d+d\d+$/.test(text(values.versatile)) ? text(values.versatile) : "";
      const normal = whole(values.rangeNormal, 0);
      const long = whole(values.rangeLong, 0);
      const span = normal > 0 ? { normal, long: Math.max(long, normal) } : undefined;
      const reach = properties.some((p) => p.endsWith("/reach"));
      const thrown = properties.some((p) => p.endsWith("/thrown"));
      entry = {
        id,
        kind: "item",
        effects: [],
        data: {
          ...itemBase(values, "weapon"),
          weapon: {
            category,
            kind,
            damage: { dice, type },
            ...(versatile && { twoHandedDamage: { dice: versatile, type } }),
            properties,
            range:
              kind === "ranged" ? (span ?? { normal: 80, long: 320 }) : { normal: reach ? 10 : 5 },
            ...(kind === "melee" && thrown && span && { throwRange: span }),
            proficiency: [`weapon:${category}-weapons`],
          },
        },
      };
      break;
    }
    case "armor": {
      const category = ["light", "medium", "heavy", "shield"].includes(values.acategory ?? "")
        ? (values.acategory as string)
        : "light";
      const maxDex = text(values.maxDex) === "" ? undefined : whole(values.maxDex, 2);
      entry = {
        id,
        kind: "item",
        effects: [],
        data: {
          ...itemBase(values, "armor"),
          armor: {
            category,
            base: whole(values.base, category === "shield" ? 2 : 10),
            dexBonus: on(values.dexBonus),
            ...(maxDex !== undefined && { maxDexBonus: maxDex }),
            strengthMinimum: Math.max(0, whole(values.strMin, 0)),
            stealthDisadvantage: on(values.stealth),
            proficiency: [category === "shield" ? "armor:shields" : `armor:${category}-armor`],
          },
        },
      };
      break;
    }
    case "gear": {
      entry = {
        id,
        kind: "item",
        effects: [],
        data: itemBase(values, "adventuring-gear"),
      };
      break;
    }
    case "language": {
      put("speakers", values.speakers);
      put("script", values.script);
      entry = { id, kind: "language", effects: [], data: {} };
      break;
    }
    case "feat": {
      const effects: Effect[] = [];
      if (ABILITY_IDS.some((a) => a === values.bonusAbility) && whole(values.bonusValue, 1) !== 0)
        effects.push({
          type: "abilityBonus",
          ability: values.bonusAbility as (typeof ABILITY_IDS)[number],
          value: whole(values.bonusValue, 1),
        });
      const prerequisites = ABILITY_IDS.some((a) => a === values.prereqAbility)
        ? [{ ability: values.prereqAbility, minimum: whole(values.prereqMin, 13) }]
        : [];
      entry = { id, kind: "feat", effects, data: { prerequisites, requirements: "" } };
      break;
    }
    case "species": {
      const effects: Effect[] = [];
      for (const ability of ABILITY_IDS) {
        const value = whole(values[`bonus-${ability}`], 0);
        if (value !== 0) effects.push({ type: "abilityBonus", ability, value });
      }
      for (const language of list(values.languages))
        effects.push({ type: "proficiency", category: "language", target: language });
      const used = new Set<string>();
      for (const trait of draft.traits) {
        const traitName = text(trait.name);
        if (!traitName) continue;
        let slug = `${slugOf(id)}-${slugify(traitName) || "trait"}`;
        for (let n = 2; used.has(slug); n++)
          slug = `${slugOf(id)}-${slugify(traitName) || "trait"}-${n}`;
        used.add(slug);
        const traitId = idOf(pack, "trait", slug);
        extra.push({ id: traitId, kind: "trait", effects: [], data: {} });
        strings[`${traitId}.name`] = traitName;
        if (text(trait.text)) strings[`${traitId}.desc`] = text(trait.text);
        effects.push({ type: "trait", id: traitId });
      }
      entry = {
        id,
        kind: "species",
        effects,
        data: {
          speed: Math.max(0, whole(values.speed, 30)),
          size: SIZES.find((s) => s === values.size) ?? "medium",
        },
      };
      break;
    }
    case "background": {
      const effects: Effect[] = list(values.skills).map((target) => ({
        type: "proficiency" as const,
        category: "skill" as const,
        target,
      }));
      const choices = Math.min(4, Math.max(0, whole(values.languageChoices, 0)));
      if (choices > 0)
        effects.push({
          type: "choice",
          id: `${slugOf(id)}-language`,
          choose: choices,
          grants: "language",
          from: context.languages,
        });
      const choose: Record<string, number> = {};
      const tables: [string, number][] = [
        ["personalityTraits", 2],
        ["ideals", 1],
        ["bonds", 1],
        ["flaws", 1],
      ];
      for (const [field, count] of tables) {
        const rows = lines(values[field]);
        if (rows.length === 0) continue;
        choose[field] = Math.min(count, rows.length);
        rows.forEach((row, n) => {
          strings[`${id}.${field}.${n + 1}`] = row;
        });
      }
      put("featureName", values.featureName);
      put("featureDesc", values.featureDesc);
      entry = { id, kind: "background", effects, data: { choose } };
      break;
    }
  }
  return { entries: [entry, ...extra], strings };
}

/** The form a stored entry came from, so it can be edited again. */
export function draftFromEntry(
  entry: Entry,
  strings: Record<string, string>,
  entries: Entry[],
): Draft | undefined {
  const s = (field: string) => strings[`${entry.id}.${field}`] ?? "";
  // biome-ignore lint/suspicious/noExplicitAny: entry data is free-form and read defensively below
  const d = entry.data as Record<string, any>;
  const values: Record<string, string> = { name: s("name"), desc: s("desc") };
  const flag = (v: unknown) => (v ? "true" : "");
  const itemCommon = () => {
    values.costAmount = String(d.cost?.amount ?? 0);
    values.costUnit = String(d.cost?.unit ?? "gp");
    if (d.weight !== undefined) values.weight = String(d.weight);
  };

  switch (entry.kind) {
    case "spell": {
      const components: string[] = d.components ?? [];
      Object.assign(values, {
        level: String(d.level ?? 0),
        school: String(d.school ?? ""),
        compV: flag(components.includes("V")),
        compS: flag(components.includes("S")),
        compM: flag(components.includes("M")),
        ritual: flag(d.ritual),
        concentration: flag(d.concentration),
        classes: ((d.classes as string[] | undefined) ?? []).join(","),
        higherLevel: s("higherLevel"),
        castingTime: s("castingTime"),
        range: s("range"),
        duration: s("duration"),
        material: s("material"),
      });
      return { kind: "spell", values, traits: [] };
    }
    case "item": {
      itemCommon();
      if (d.weapon) {
        const w = d.weapon;
        const span = w.kind === "ranged" ? w.range : w.throwRange;
        Object.assign(values, {
          wcategory: String(w.category ?? "simple"),
          wkind: String(w.kind ?? "melee"),
          damage: String(w.damage?.dice ?? ""),
          damageType: String(w.damage?.type ?? ""),
          versatile: String(w.twoHandedDamage?.dice ?? ""),
          properties: ((w.properties as string[] | undefined) ?? []).join(","),
          rangeNormal: span ? String(span.normal) : "",
          rangeLong: span?.long ? String(span.long) : "",
        });
        return { kind: "weapon", values, traits: [] };
      }
      if (d.armor) {
        const a = d.armor;
        Object.assign(values, {
          acategory: String(a.category ?? "light"),
          base: String(a.base ?? 10),
          dexBonus: flag(a.dexBonus),
          maxDex: a.maxDexBonus !== undefined ? String(a.maxDexBonus) : "",
          strMin: String(a.strengthMinimum ?? 0),
          stealth: flag(a.stealthDisadvantage),
        });
        return { kind: "armor", values, traits: [] };
      }
      return { kind: "gear", values, traits: [] };
    }
    case "language":
      values.speakers = s("speakers");
      values.script = s("script");
      return { kind: "language", values, traits: [] };
    case "feat": {
      const bonus = entry.effects.find((e) => e.type === "abilityBonus");
      const need = (d.prerequisites as { ability: string; minimum: number }[] | undefined)?.[0];
      if (bonus?.type === "abilityBonus") {
        values.bonusAbility = bonus.ability;
        values.bonusValue = String(bonus.value);
      }
      if (need) {
        values.prereqAbility = need.ability;
        values.prereqMin = String(need.minimum);
      }
      return { kind: "feat", values, traits: [] };
    }
    case "species": {
      values.speed = String(d.speed ?? 30);
      values.size = String(d.size ?? "medium");
      const languages: string[] = [];
      const traits: DraftTrait[] = [];
      for (const effect of entry.effects) {
        if (effect.type === "abilityBonus")
          values[`bonus-${effect.ability}`] = String(effect.value);
        else if (effect.type === "proficiency" && effect.category === "language")
          languages.push(effect.target);
        else if (effect.type === "trait") {
          const owned = entries.find((e) => e.id === effect.id);
          if (owned)
            traits.push({
              name: strings[`${owned.id}.name`] ?? "",
              text: strings[`${owned.id}.desc`] ?? "",
            });
        }
      }
      values.languages = languages.join(",");
      return { kind: "species", values, traits };
    }
    case "background": {
      values.skills = entry.effects
        .flatMap((e) => (e.type === "proficiency" && e.category === "skill" ? [e.target] : []))
        .join(",");
      const choice = entry.effects.find((e) => e.type === "choice" && e.grants === "language");
      values.languageChoices = choice?.type === "choice" ? String(choice.choose) : "";
      values.featureName = s("featureName");
      values.featureDesc = s("featureDesc");
      for (const field of ["personalityTraits", "ideals", "bonds", "flaws"]) {
        const rows: string[] = [];
        for (let n = 1; strings[`${entry.id}.${field}.${n}`] !== undefined; n++)
          rows.push(strings[`${entry.id}.${field}.${n}`] ?? "");
        values[field] = rows.join("\n");
      }
      return { kind: "background", values, traits: [] };
    }
    default:
      return undefined;
  }
}

/** The kind of editor form that suits a stored entry, when the editor can open it. */
export function editableKind(entry: Entry): HomebrewKind | undefined {
  return draftFromEntry(entry, {}, [])?.kind;
}

/** A new homebrew pack with nothing in it yet. */
export function newHomebrewPack(name: string, now = Date.now()): UserPackRecord {
  const id = `hb${now.toString(36)}`;
  return {
    id,
    name: name.trim() || "My homebrew",
    origin: "homebrew",
    addedAt: now,
    lang: "en",
    pack: {
      manifest: {
        id,
        ruleset: "custom",
        version: "1",
        license: "Homebrew content written by its author",
        attribution: "Homebrew content written by the user.",
      },
      entries: [],
    },
    strings: {},
  };
}

/** Ids of the entries a species owns: the traits the editor made for it. */
function ownedIds(entry: Entry): string[] {
  if (entry.kind !== "species") return [];
  return entry.effects.flatMap((e) =>
    e.type === "trait" && packOf(e.id) === packOf(entry.id) ? [e.id] : [],
  );
}

/** Takes an entry out of a pack, with its texts and the traits it owns. */
export function removeEntry(record: UserPackRecord, id: string): UserPackRecord {
  const entry = record.pack.entries.find((e) => e.id === id);
  if (!entry) return record;
  const gone = new Set([id, ...ownedIds(entry)]);
  const strings = Object.fromEntries(
    Object.entries(record.strings).filter(
      ([key]) => ![...gone].some((g) => key.startsWith(`${g}.`)),
    ),
  );
  return {
    ...record,
    strings,
    pack: { ...record.pack, entries: record.pack.entries.filter((e) => !gone.has(e.id)) },
  };
}

/** An id for a new entry: its name as a slug, made unique within the pack. */
export function freshId(record: UserPackRecord, kind: Entry["kind"], name: string): Id {
  const base = slugify(name) || kind;
  const taken = new Set(record.pack.entries.map((e) => e.id));
  let slug = base;
  for (let n = 2; taken.has(idOf(record.id, kind, slug)); n++) slug = `${base}-${n}`;
  return idOf(record.id, kind, slug);
}

/** Saves a draft in the pack: a new entry, or a replacement for the one being edited. */
export function saveDraft(
  record: UserPackRecord,
  draft: Draft,
  context: BuildContext,
  editing?: string,
): { record: UserPackRecord; id: string } {
  const entryKind = ["weapon", "armor", "gear"].includes(draft.kind)
    ? "item"
    : (draft.kind as Entry["kind"]);
  const base = editing ? removeEntry(record, editing) : record;
  const id = editing ?? freshId(base, entryKind, draft.values.name ?? "");
  const built = buildDraft(draft, id as Id, context);
  return {
    id,
    record: {
      ...base,
      strings: { ...base.strings, ...built.strings },
      pack: { ...base.pack, entries: [...base.pack.entries, ...built.entries] },
    },
  };
}

/** The entries a person can open in the editor, in the order they were made. */
export function editableEntries(record: UserPackRecord): Entry[] {
  return record.pack.entries.filter((e) => e.kind !== "trait" && editableKind(e));
}
