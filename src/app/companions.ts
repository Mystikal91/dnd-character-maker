import type { Companion } from "../engine/character";
import { updateCharacter } from "./store";

/** Gives the open character a creature, at full health. */
export function addCompanion(monster: string) {
  updateCharacter((draft) => {
    draft.companions = [...(draft.companions ?? []), { id: crypto.randomUUID(), monster }];
  });
}

export function removeCompanion(id: string) {
  updateCharacter((draft) => {
    const rest = (draft.companions ?? []).filter((c) => c.id !== id);
    if (rest.length > 0) draft.companions = rest;
    else draft.companions = undefined;
  });
}

/** Edits one companion of the open character and saves it like any other change. */
export function changeCompanion(id: string, edit: (companion: Companion) => Companion) {
  updateCharacter((draft) => {
    draft.companions = (draft.companions ?? []).map((c) => (c.id === id ? edit(c) : c));
  });
}
