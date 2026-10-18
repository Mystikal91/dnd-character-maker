/**
 * Problems the engine notices while deriving a sheet. They are data, not text, so the UI can
 * translate them: `params` hold ids, ability ids and numbers that the UI formats.
 */
export type WarningCode =
  | "unknownEntry"
  | "levelTooHigh"
  | "abilityTooHigh"
  | "subclassMismatch"
  | "multiclassSpellcasting"
  | "multipleArmor"
  | "multipleShields"
  | "strengthMinimum"
  | "notProficient"
  | "invalidChoice"
  | "tooManyChoices"
  | "asiInvalid"
  | "asiTooMany";

export interface Warning {
  code: WarningCode;
  params: Record<string, string | number>;
}

export function warn(
  list: Warning[],
  code: WarningCode,
  params: Record<string, string | number> = {},
): void {
  list.push({ code, params });
}
