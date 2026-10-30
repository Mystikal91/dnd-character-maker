import { signal } from "@preact/signals";
import type { ChangelogEntry } from "../content/news";
import { loadNewerEntries } from "../content/whatsNew.logic";
import { VERSION } from "./version";

/** Set when a new version of the app is ready: calling it installs the version and reloads. */
export const applyUpdate = signal<(() => void) | undefined>(undefined);

/** What the waiting version brings, read from the website: the versions newer than this one. */
export const updateNews = signal<ChangelogEntry[]>([]);

/** Asks the website what changes in the update that is ready (it stays empty without a connection). */
export async function loadUpdateNews(): Promise<void> {
  updateNews.value = await loadNewerEntries(VERSION);
}
