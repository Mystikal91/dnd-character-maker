import type { Effect } from "../../data/schema";

/**
 * The natural weapons of the species of the official books, written by hand. Aurora has them only
 * as a sentence ("your claws are natural weapons... 1d4 + your Strength modifier slashing damage"):
 * the dice and the kind of damage are in no rule, and the importer does not read them out of the
 * text. Each line was read in the book's own text, and the two printings of the same species do
 * differ (the Tabaxi of Volo's has 1d4, that of Monsters of the Multiverse 1d6).
 *
 * Left out on purpose: the bite of the dhampir (it uses Constitution and drains), the grappling
 * appendages of the simic hybrid (a choice with a grapple), the shifter's bite (only while
 * shifting) and the lycanthropy forms (only in the hybrid form).
 */
export const NATURAL_WEAPONS: Record<string, { dice: string; damageType: string }> = {
  // Monsters of the Multiverse
  ID_WOTC_MOTM_RACIAL_TRAIT_AARAKOCRA_TALONS: { dice: "1d6", damageType: "slashing" },
  ID_WOTC_MOTM_RACIAL_TRAIT_CENTAUR_HOOVES: { dice: "1d6", damageType: "bludgeoning" },
  ID_WOTC_MOTM_RACIAL_TRAIT_LIZARDFOLK_BITE: { dice: "1d6", damageType: "slashing" },
  ID_WOTC_MOTM_RACIAL_TRAIT_MINOTAUR_HORNS: { dice: "1d6", damageType: "piercing" },
  ID_WOTC_MOTM_RACIAL_TRAIT_SATYR_RAM: { dice: "1d6", damageType: "bludgeoning" },
  ID_WOTC_MOTM_RACIAL_TRAIT_TABAXI_CATS_CLAWS: { dice: "1d6", damageType: "slashing" },
  ID_WOTC_MOTM_RACIAL_TRAIT_TORTLE_CLAWS: { dice: "1d6", damageType: "slashing" },
  // Volo's Guide to Monsters
  ID_WOTC_VGTM_RACIAL_TRAIT_LIZARDFOLK_BITE: { dice: "1d6", damageType: "piercing" },
  ID_WOTC_VGTM_RACIAL_TRAIT_TAXBAXI_CATS_CLAWS: { dice: "1d4", damageType: "slashing" },
  // Tomb of Annihilation (the tortle), Guildmasters' Guide to Ravnica, Mythic Odysseys of Theros
  ID_WOTC_TOA_RACIAL_TRAIT_TORTLE_CLAWS: { dice: "1d4", damageType: "slashing" },
  ID_WOTC_GGTR_RACIAL_TRAIT_CENTAUR_HOOVES: { dice: "1d4", damageType: "bludgeoning" },
  ID_WOTC_GGTR_RACIAL_TRAIT_MINOTAUR_HORNS: { dice: "1d6", damageType: "piercing" },
  ID_WOTC_MOOT_RACIAL_TRAIT_LEONIN_CLAWS: { dice: "1d4", damageType: "slashing" },
  ID_WOTC_MOOT_RACIAL_TRAIT_SATYR_RAM: { dice: "1d4", damageType: "bludgeoning" },
};

/** The natural weapon of a racial trait, as the effect that makes the unarmed strike use it. */
export function naturalWeaponEffects(aid: string): Effect[] {
  const weapon = NATURAL_WEAPONS[aid];
  return weapon
    ? [{ type: "unarmedStrike", dice: weapon.dice, damageType: weapon.damageType }]
    : [];
}
