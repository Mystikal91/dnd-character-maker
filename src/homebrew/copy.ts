import type { Entry } from "../data/schema";
import { type Draft, draftFromEntry } from "./model";

/** Where the texts of the rules come from: the entries and the text fields each has. */
export interface TextSource {
  index: ReadonlyMap<string, Entry>;
  fields(id: string): string[];
  /** A text as it reads on screen now. */
  read(id: string, field: string): string;
}

/** The ids of the entries an entry owns: the traits of a species, the features of a class. */
function relatedIds(entry: Entry): string[] {
  const traits = entry.effects.flatMap((e) => (e.type === "trait" ? [e.id as string] : []));
  const levels = ((entry.data as { levels?: { features?: string[] }[] }).levels ?? []).flatMap(
    (row) => row.features ?? [],
  );
  return [...traits, ...levels];
}

/**
 * The editor form of a rules entry, to save it as a new homebrew entry. The texts are the ones on
 * screen, the traits or features it owns come along, and the name says it is a copy. Undefined
 * for an entry the editor cannot open.
 */
export function copyDraft(
  entry: Entry,
  source: TextSource,
  copyName: (name: string) => string,
): Draft | undefined {
  const entries = [entry, ...relatedIds(entry).flatMap((id) => source.index.get(id) ?? [])];
  const strings: Record<string, string> = {};
  for (const e of entries)
    for (const field of source.fields(e.id)) strings[`${e.id}.${field}`] = source.read(e.id, field);
  const draft = draftFromEntry(entry, strings, entries);
  if (!draft) return undefined;
  draft.values.name = copyName(draft.values.name ?? "");
  return draft;
}
