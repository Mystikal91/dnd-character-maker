/**
 * Tasha's optional class features that take the place of one the class has. Aurora marks the swap
 * with an internal flag (`ID_INTERNAL_FEATURE_REPLACEMENT_*`) that the feature it replaces tests
 * for; the entries of the app that stand for the replaced feature are listed here by hand, since
 * the SRD lists some of them once for each step. Ids the app does not have are left out when the
 * option is made (the Beast Master has no entry in the SRD).
 */
export const REPLACED_BY_FLAG: Record<string, string[]> = {
  ID_INTERNAL_FEATURE_REPLACEMENT_RANGER_NATURAL_EXPLORER: [
    "srd51:feature/natural-explorer-1-terrain-type",
    "srd51:feature/natural-explorer-2-terrain-types",
    "srd51:feature/natural-explorer-3-terrain-types",
  ],
  ID_INTERNAL_FEATURE_REPLACEMENT_RANGER_FAVORED_ENEMY: [
    "srd51:feature/favored-enemy-1-type",
    "srd51:feature/favored-enemy-2-types",
    "srd51:feature/favored-enemy-3-enemies",
  ],
  ID_INTERNAL_FEATURE_REPLACEMENT_RANGER_PRIMEVAL_AWARENESS: ["srd51:feature/primeval-awareness"],
  ID_INTERNAL_FEATURE_REPLACEMENT_RANGER_HIDE_IN_PLAIN_SIGHT: ["srd51:feature/hide-in-plain-sight"],
  ID_INTERNAL_FEATURE_REPLACEMENT_CLERIC_DIVINE_STRIKE_OR_POTENT_SPELLCASTING: [
    "srd51:feature/divine-strike",
  ],
};
