import type { Companion } from "../engine/character";
import { uuid } from "../engine/uuid";
import { updateCharacter } from "./store";

/** Gives the open character a creature, at full health. */
export function addCompanion(monster: string) {
  updateCharacter((draft) => {
    draft.companions = [...(draft.companions ?? []), { id: uuid(), monster }];
  });
}

export function removeCompanion(id: string) {
  updateCharacter((draft) => {
    const rest = (draft.companions ?? []).filter((c) => c.id !== id);
    if (rest.length > 0) draft.companions = rest;
    else draft.companions = undefined;
  });
}

/** Puts a creature back where it was in the list, after it was removed by mistake. */
export function restoreCompanion(companion: Companion, index: number) {
  updateCharacter((draft) => {
    const list = [...(draft.companions ?? [])];
    if (list.some((c) => c.id === companion.id)) return;
    list.splice(Math.min(Math.max(index, 0), list.length), 0, companion);
    draft.companions = list;
  });
}

/** Edits one companion of the open character and saves it like any other change. */
export function changeCompanion(id: string, edit: (companion: Companion) => Companion) {
  updateCharacter((draft) => {
    draft.companions = (draft.companions ?? []).map((c) => (c.id === id ? edit(c) : c));
  });
}
