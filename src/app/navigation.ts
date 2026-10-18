import { signal } from "@preact/signals";

/** Which screen is showing. */
export type View = "edit" | "print" | "credits";

export const view = signal<View>("edit");

export function showView(next: View) {
  view.value = next;
}
