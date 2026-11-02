import { signal } from "@preact/signals";

/** What the person can take back: a short line for the notice, and what puts it right. */
export interface UndoOffer {
  id: number;
  label: string;
  undo: () => void | Promise<void>;
}

/** How long the notice stays. */
const UNDO_MS = 10000;

/** The change that can be taken back now: one at a time, the newest. */
export const undoOffer = signal<UndoOffer | undefined>(undefined);

let timer: ReturnType<typeof setTimeout> | undefined;
let nextId = 1;

/**
 * Offers to take back what was just done, in place of asking before it: do the thing, then call this
 * with a line that says what happened and a function that restores it.
 */
export function offerUndo(label: string, undo: () => void | Promise<void>) {
  clearTimeout(timer);
  const id = nextId++;
  undoOffer.value = { id, label, undo };
  timer = setTimeout(() => {
    if (undoOffer.value?.id === id) undoOffer.value = undefined;
  }, UNDO_MS);
}

/** Takes the change back. */
export async function takeUndo() {
  const offer = undoOffer.value;
  if (!offer) return;
  clearTimeout(timer);
  undoOffer.value = undefined;
  await offer.undo();
}

export function dismissUndo() {
  clearTimeout(timer);
  undoOffer.value = undefined;
}
