import type { ClassResource, ResourceRecovery } from "./resources";

/**
 * A feature that a person writes on their own character: a boon, a gift of a patron, something
 * the table agreed on. It has a name and a text, and may be usable a number of times between rests.
 */
export interface CustomFeature {
  id: string;
  name: string;
  text: string;
  /** How many times it can be used before it must recharge; absent when it has no limit. */
  uses?: number | undefined;
  recharge?: ResourceRecovery | undefined;
}

export const MAX_CUSTOM_USES = 99;

export function newCustomFeature(): CustomFeature {
  return { id: crypto.randomUUID().slice(0, 8), name: "", text: "" };
}

/** The limited uses of the custom features, to be ticked off in play like those of a class. */
export function customResources(features: CustomFeature[]): ClassResource[] {
  return features.flatMap((f) =>
    f.uses && f.uses > 0
      ? [
          {
            id: `custom:${f.id}`,
            kind: "custom",
            classId: "",
            name: f.name,
            max: Math.min(Math.floor(f.uses), MAX_CUSTOM_USES),
            recovery: f.recharge ?? "long",
            // Many uses are counted as a number, not as marks to tick off.
            ...(f.uses > 8 && { pool: true }),
          },
        ]
      : [],
  );
}
