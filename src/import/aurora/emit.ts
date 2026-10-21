import type { Effect, Entry } from "../../data/schema";
import { type Context, type Source, ofType } from "./registry";

/** Adds an entry for an element, with its name and any other texts. */
export function emit(
  ctx: Context,
  source: Source,
  data: Record<string, unknown>,
  texts: Record<string, string | undefined> = {},
  extra: { effects?: Effect[]; parent?: string } = {},
): void {
  if (!source.id || !source.kind) return;
  ctx.result.entries.push({
    id: source.id,
    kind: source.kind,
    ...(extra.parent && { parent: extra.parent }),
    effects: extra.effects ?? [],
    data,
  } as Entry);
  ctx.result.strings[`${source.id}.name`] = source.name;
  for (const [field, value] of Object.entries(texts)) {
    if (value) ctx.result.strings[`${source.id}.${field}`] = value;
  }
  if (source.source) ctx.result.sources.push(source.source);
}

/** The id of the class with this name: one the app has, or one this pack creates. */
export function classIdByName(ctx: Context, name: string): string | undefined {
  const lower = name.trim().toLowerCase();
  const existing = ctx.existingByName.get(`class|${lower}`);
  if (existing) return existing;
  return ofType(ctx, "Class").find((s) => s.name.toLowerCase() === lower && s.id)?.id;
}
