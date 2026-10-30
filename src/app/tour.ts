import { signal } from "@preact/signals";
import { type Tab, showView, view } from "./navigation";
import { TOUR_STEPS, stepAfter, stepBefore } from "./tour.logic";

const KEY = "tour-done";

/** Which stop of the guided tour is showing; undefined while there is no tour. */
export const tourStep = signal<number | undefined>(undefined);

/** The tab that was open when the tour began, to go back to when it ends. */
let startedOn: Tab | undefined;

export function tourDone(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function startTour() {
  const current = view.value;
  startedOn = current === "build" || current === "sheet" || current === "play" ? current : "build";
  tourStep.value = 0;
}

/** Leaves the tour, from the last stop or any other; the tab that was open comes back. */
export function endTour() {
  tourStep.value = undefined;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Not remembered: the tour is only offered again, which is harmless.
  }
  if (startedOn) showView(startedOn);
  startedOn = undefined;
}

export function nextStop() {
  const index = tourStep.value;
  if (index === undefined) return;
  const following = stepAfter(index);
  if (following === undefined) endTour();
  else tourStep.value = following;
}

export function previousStop() {
  const index = tourStep.value;
  if (index === undefined) return;
  const before = stepBefore(index);
  if (before !== undefined) tourStep.value = before;
}

export const tourLength = TOUR_STEPS.length;
