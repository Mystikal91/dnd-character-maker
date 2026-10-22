import { signal } from "@preact/signals";
import { AURORA_IMPORT_VERSION } from "../import/aurora";

const STORAGE_KEY = "packsNoticeDismissed";

function readDismissed(): number {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** The importer version for which the person said "later"; the notice returns with a newer one. */
export const dismissedVersion = signal(readDismissed());

export function dismissPacksNotice(): void {
  dismissedVersion.value = AURORA_IMPORT_VERSION;
  try {
    localStorage.setItem(STORAGE_KEY, String(AURORA_IMPORT_VERSION));
  } catch {
    // Ignore: the notice will come back next time.
  }
}

/** The notice about outdated packs shows while there are some and it was not put off. */
export const showsPacksNotice = (stale: number, dismissed: number): boolean =>
  stale > 0 && dismissed < AURORA_IMPORT_VERSION;
