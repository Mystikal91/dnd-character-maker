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
