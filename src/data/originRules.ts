import { ABILITIES, type Effect, type Entry, type Pack } from "./schema";

/**
 * What the books say about the species of the SRD that the SRD data itself does not: their ability
 * increases and some traits depend on rules that other content switches (a sub-race that brings
 * its own increases, a variant that replaces a trait, Tasha's customised origin). Aurora writes
 * those as requirements on the rules of the species; here the same requirements are put on the
 * species of the app, so that content imported from Aurora, which sets the same flags, works with
 * them whether or not the files of the species were imported together with it.
 */

const CUSTOM_ASI = "ID_WOTC_TCOE_OPTION_CUSTOMIZED_ASI";
const BACKGROUND_ASI = "ID_INTERNAL_GRANTS_BACKGROUND_ASI";

interface SpeciesRules {
  /** Flags that take away the fixed increases (a sub-race or variant that has its own). */
  asi: string[];
  /** Whether the customised origin of Tasha applies (Aurora has no such rule for the human). */
  custom?: boolean;
  /** Traits a flag takes away, by slug. */
  traits?: Record<string, string>;
}

const DRAGONMARK = "ID_INTERNAL_GRANTS_DRAGONMARK";
const DARKMARKED = "ID_WOTC_WGTE_GRANTS_DARKMARKED";

const SPECIES: Record<string, SpeciesRules> = {
  dragonborn: {
    asi: ["ID_WOTC_EGTW_GRANTS_DRAGONBORN_VARIANT"],
    custom: true,
    traits: { "damage-resistance": "!ID_WOTC_EGTW_GRANTS_DRAGONBORN_VARIANT" },
  },
  dwarf: { asi: [], custom: true },
  elf: { asi: ["ID_UA_PSK_GRANTS_ELF_SUBRACE"], custom: true },
  gnome: { asi: [], custom: true },
  "half-elf": {
    asi: [DARKMARKED, DRAGONMARK],
    custom: true,
    traits: {
      "skill-versatility": `!(ID_WOTC_SCAG_GRANTS_VARIANT_HALF_ELF||${DARKMARKED}||${DRAGONMARK})`,
    },
  },
  halfling: { asi: [], custom: true },
  "half-orc": {
    asi: [DARKMARKED, DRAGONMARK],
    custom: true,
    traits: {
      darkvision: `!${DRAGONMARK}`,
      menacing: `!${DARKMARKED},!${DRAGONMARK}`,
      "relentless-endurance": `!${DARKMARKED},!${DRAGONMARK}`,
      "savage-attacks": `!${DARKMARKED},!${DRAGONMARK}`,
    },
  },
  human: {
    asi: [
      "ID_INTERNAL_GRANTS_REQTEMPFIX",
      "ID_RACE_VARIANT_HUMAN_VARIANT",
      DRAGONMARK,
      DARKMARKED,
      "ID_UA_PS_GRANTS_HUMAN_VARIANT",
    ],
  },
  tiefling: {
    asi: ["ID_INTERNAL_GRANTS_TIEFLING_SUBRACE"],
    custom: true,
    traits: {
      "infernal-legacy": "!ID_INTERNAL_GRANTS_TIEFLING_SUBRACE",
      "hellish-resistance": "!ID_INTERNAL_RACIAL_TRAIT_REPLACEMENT_TIEFLING_HELLISH_RESISTANCE",
    },
  },
};

const group = (words: string[]) => `(${words.join("||")})`;

function gateSpecies(entry: Entry, rules: SpeciesRules): Entry {
  const without = [...rules.asi, ...(rules.custom ? [CUSTOM_ASI] : []), BACKGROUND_ASI];
  const isIncrease = (e: Effect) =>
    e.type === "abilityBonus" || (e.type === "choice" && e.grants === "abilityBonus");
  const increases = entry.effects.filter(isIncrease);
  const effects: Effect[] = [];
  for (const effect of entry.effects) {
    const requirement = effect.type === "trait" ? rules.traits?.[effect.id.split("/")[1] ?? ""] : "";
    if (isIncrease(effect)) {
      // All the increases go behind one requirement, at the place of the first.
      if (effect === increases[0])
        effects.push({ type: "when", requires: `!${group(without)}`, effects: increases });
    } else if (requirement) {
      effects.push({ type: "when", requires: requirement, effects: [effect] });
    } else effects.push(effect);
  }
  if (rules.custom) {
    // Tasha's customised origin: +2 to one score and +1 to another, in place of the fixed ones.
    const others = rules.asi.length > 0 ? `,!${group(rules.asi)}` : "";
    const pick = (id: string, value: number): Effect => ({
      type: "choice",
      id,
      choose: 1,
      grants: "abilityBonus",
      from: [...ABILITIES],
      value,
    });
    effects.push({
      type: "when",
      requires: `${CUSTOM_ASI},!${BACKGROUND_ASI}${others}`,
      effects: [pick("custom-asi-2", 2), pick("custom-asi-1", 1)],
    });
  }
  return { ...entry, effects };
}

/** The same pack, with the species of the SRD carrying the requirements that the books put on them. */
export function withOriginRules(pack: Pack): Pack {
  if (pack.manifest.id !== "srd51") return pack;
  return {
    ...pack,
    entries: pack.entries.map((entry) => {
      const slug = entry.id.split("/")[1] ?? "";
      if (entry.kind === "species" && SPECIES[slug]) return gateSpecies(entry, SPECIES[slug]);
      if (entry.kind === "subspecies")
        // A sub-race's own increase gives way to the customised origin and to a background's.
        return {
          ...entry,
          effects: entry.effects.some((e) => e.type === "abilityBonus")
            ? [
                {
                  type: "when" as const,
                  requires: `!${group([CUSTOM_ASI, BACKGROUND_ASI])}`,
                  effects: entry.effects.filter((e) => e.type === "abilityBonus"),
                },
                ...entry.effects.filter((e) => e.type !== "abilityBonus"),
              ]
            : entry.effects,
        };
      return entry;
    }),
  };
}
