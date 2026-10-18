import { computed, signal } from "@preact/signals";
import type { Content } from "../content/browser";
import { type Character, createCharacter } from "../engine/character";
import { type DerivedSheet, deriveSheet } from "../engine/derive";

export const content = signal<Content | undefined>(undefined);
export const loadError = signal<string | undefined>(undefined);
export const character = signal<Character>(createCharacter("srd51"));

/** The sheet is always derived: it recomputes whenever the character or content changes. */
export const sheet = computed<DerivedSheet | undefined>(() =>
  content.value ? deriveSheet(character.value, content.value.index) : undefined,
);

/** Edits a copy of the character and publishes it, so every dependent view updates. */
export function updateCharacter(edit: (draft: Character) => void) {
  const draft = structuredClone(character.value);
  edit(draft);
  character.value = draft;
}
