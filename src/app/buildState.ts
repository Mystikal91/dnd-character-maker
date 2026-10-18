import { signal } from "@preact/signals";
import type { LevelUpSummary } from "../engine/levelUp";

export type StepId =
  | "origin"
  | "class"
  | "abilities"
  | "choices"
  | "spells"
  | "equipment"
  | "story"
  | "freeEdit";

/** The build step that is open. Only one is open at a time, so the page stays short. */
export const openStep = signal<StepId>("origin");

/** Where the level up flow is: closed, choosing the class, or showing what is left to do. */
export const levelUpPhase = signal<"closed" | "choose" | "done">("closed");

/** What the last level up brought, shown on the "done" screen. */
export const levelUpResult = signal<LevelUpSummary | undefined>(undefined);
