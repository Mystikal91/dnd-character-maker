import type { PackIndex } from "../engine/derive";
import { entryRelinker } from "../engine/relink";

/** The quick edits of one language live together in a pack of their own. */
export const editsPackId = (lang: string) => `edits${lang}`;

/**
 * The texts of the quick edits after saving `values` for an entry. Only what differs from the
 * original is kept, and an empty text goes back to the original.
 */
export function nextEditStrings(
  current: Record<string, string>,
  id: string,
  values: Record<string, string>,
  base: (field: string) => string | undefined,
): Record<string, string> {
  const next = new Map(Object.entries(current));
  for (const [field, raw] of Object.entries(values)) {
    const key = `${id}.${field}`;
    const text = raw.replace(/\r\n/g, "\n").trim();
    if (!text || text === (base(field) ?? "").trim()) next.delete(key);
    else next.set(key, text);
  }
  return Object.fromEntries(next);
}

const EDIT_KEY = /^([a-z][a-z0-9]*:[a-z]+\/[a-z0-9-]+)\.([\s\S]+)$/;

/**
 * The quick edits whose entry is no longer there under the id they were made with, because its
 * pack was imported or downloaded again and got a new id: the same texts under the id the entry
 * has now (see `entryRelinker`), as `new key -> text`. Edits that still find their entry, or
 * whose entry cannot be told for certain, are not in it.
 */
export function relinkEdits(
  strings: Record<string, string>,
  index: PackIndex,
): Record<string, string> {
  const relink = entryRelinker(index);
  const moved: Record<string, string> = {};
  for (const [key, text] of Object.entries(strings)) {
    const match = EDIT_KEY.exec(key);
    if (!match?.[1] || !match[2]) continue;
    const now = relink(match[1]);
    if (now) moved[`${now}.${match[2]}`] = text;
  }
  return moved;
}
