import type { Entry } from "../../data/schema";
import type { AuroraResult } from "./index";

/**
 * What an import made, in a form that does not depend on how it was split: every entry is known by
 * the Aurora element it came from (or, for one that came from none, by its kind and name), and the
 * ids inside its effects and data are written the same way. Two ways of importing the same files
 * must give the same description.
 */
export interface Described {
  [key: string]: unknown;
}

const ID = /\b[a-z0-9]+:[a-z]+\/[a-z0-9]+(?:-+[a-z0-9]+)*/g;

/** The same description for one or several results that together hold what was imported. */
export function describe(
  results: AuroraResult[],
  options: { lenient?: boolean } = {},
): Map<string, Described> {
  const known = new Map<string, string>();
  const names = new Map<string, number>();
  for (const result of results) {
    const byId = new Map(Object.entries(result.aids).map(([aid, id]) => [id, aid]));
    for (const entry of result.entries) {
      const aid = byId.get(entry.id);
      if (aid) known.set(entry.id, `aid:${aid}`);
      else {
        const name = String(result.strings[`${entry.id}.name`] ?? entry.id);
        const key = `${entry.kind}|${name}`;
        const n = (names.get(key) ?? 0) + 1;
        names.set(key, n);
        known.set(entry.id, `${key}#${n}`);
      }
    }
  }
  // A name may carry the book (or the files) it comes from when two of them share it; where that
  // is shown is a matter of the list, so the name is compared without it.
  const bare = (name: unknown) => String(name).replace(/\s\([^()]*\)$/, "");
  const canon = (value: unknown): unknown => {
    let text = JSON.stringify(value).replace(ID, (id) => known.get(id) ?? id);
    // Lenient: a reference that could not be resolved still names the Aurora id it was about.
    if (options.lenient) text = text.replace(/aid:/g, "");
    return JSON.parse(text);
  };
  const described = new Map<string, Described>();
  for (const result of results)
    for (const entry of result.entries as Entry[]) {
      const key = known.get(entry.id) as string;
      const strings = Object.fromEntries(
        Object.entries(result.strings)
          .filter(([k]) => k.startsWith(`${entry.id}.`))
          .map(([k, text]) => [
            k.slice(entry.id.length + 1),
            k.endsWith(".name") ? bare(text) : text,
          ]),
      );
      described.set(key, {
        kind: entry.kind,
        parent: entry.parent ? known.get(entry.parent) : undefined,
        effects: canon(entry.effects),
        data: canon(entry.data),
        strings: canon(strings),
      });
    }
  return described;
}

/** What differs between two descriptions: entries only in one, and the fields that differ in both. */
export function differences(
  a: Map<string, Described>,
  b: Map<string, Described>,
): { onlyA: string[]; onlyB: string[]; changed: { key: string; fields: string[] }[] } {
  const onlyA = [...a.keys()].filter((k) => !b.has(k));
  const onlyB = [...b.keys()].filter((k) => !a.has(k));
  const changed: { key: string; fields: string[] }[] = [];
  for (const [key, left] of a) {
    const right = b.get(key);
    if (!right) continue;
    const fields = Object.keys(left).filter(
      (f) => JSON.stringify(left[f]) !== JSON.stringify(right[f]),
    );
    if (fields.length > 0) changed.push({ key, fields });
  }
  return { onlyA, onlyB, changed };
}
