import { type UiKey, ui } from "../i18n/ui";

const DAMAGE_TYPES = new Set([
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
]);

/** A kind of damage in the language ("tagliente"), or as it is written when it is not a usual one. */
export const damageName = (type: string) =>
  DAMAGE_TYPES.has(type) ? ui(`hb.o.${type}` as UiKey).toLowerCase() : type;
