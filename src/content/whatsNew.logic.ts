import { type ChangelogEntry, type Translated, pick } from "./news";

/** `1.12.3 beta` is [1, 12, 3]. Anything that is not a version is [0]. */
export function versionNumbers(version: string): number[] {
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(version.trim());
  if (!match) return [0];
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
}

/** Negative when `a` is the older version, positive when it is the newer, 0 when they are the same. */
export function compareVersions(a: string, b: string): number {
  const x = versionNumbers(a);
  const y = versionNumbers(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const difference = (x[i] ?? 0) - (y[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

const isTranslated = (value: unknown): value is Translated =>
  typeof value === "object" && value !== null && typeof (value as { en?: unknown }).en === "string";

function isEntry(value: unknown): value is ChangelogEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<ChangelogEntry>;
  return (
    typeof entry.version === "string" &&
    typeof entry.date === "string" &&
    Array.isArray(entry.notes) &&
    entry.notes.length > 0 &&
    entry.notes.every(isTranslated)
  );
}

/**
 * The versions of a list read from the website that are newer than `current`, newest first and
 * at most `limit`. Whatever is not a well-formed entry is left out: the list comes from the
 * network and is only shown, never trusted.
 */
export function newerEntries(list: unknown, current: string, limit = 3): ChangelogEntry[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter(isEntry)
    .filter((entry) => compareVersions(entry.version, current) > 0)
    .sort((a, b) => compareVersions(b.version, a.version))
    .slice(0, limit);
}

/** The first sentence of a note, or its first `max` characters cut at a word, with an ellipsis. */
export function shortNote(text: string, max = 200): string {
  const first = text.split(/(?<=[.!?])\s/)[0] ?? text;
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 1))}…`;
}

/** The short text of the first note of an entry, in a language. */
export const summaryOf = (entry: ChangelogEntry, language: string): string =>
  entry.notes[0] ? shortNote(pick(entry.notes[0], language)) : "";

/**
 * Asks the website for the list of versions and gives those newer than `current`. This is how an
 * app that is about to update can tell what the update brings: the new notes are not in the old
 * code, but they are on the website. Without a connection, or with anything unexpected, it gives
 * nothing and the update notice is just the plain one.
 */
export async function loadNewerEntries(
  current: string,
  fetcher: typeof fetch = fetch,
): Promise<ChangelogEntry[]> {
  try {
    const response = await fetcher("/changelog.json", { cache: "no-cache" });
    if (!response.ok) return [];
    const data = (await response.json()) as { entries?: unknown };
    return newerEntries(data.entries, current);
  } catch {
    return [];
  }
}
