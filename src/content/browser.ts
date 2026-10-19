import { type Pack, parsePack } from "../data/schema";
import { type PackIndex, indexPacks } from "../engine/derive";
import type { UserPackRecord } from "../storage/packs";

/** Loaded rules content plus helpers to read its translated texts. */
export interface Content {
  packs: Pack[];
  index: PackIndex;
  /** A text field of an entry (`name`, `desc`, ...), falling back through the locale chain. */
  text(id: string, field: string): string | undefined;
  /** An entry's display name; falls back to a readable form of its id. */
  name(id: string): string;
}

const packFiles = import.meta.glob<Pack>("/data/*/*.json", { import: "default" });
const stringFiles = import.meta.glob<Record<string, string>>("/locales/*/*/*.json", {
  import: "default",
});

/** `species.json` of pack `srd51` -> `/data/srd51/species.json`, `/locales/<locale>/srd51/...`. */
const localePath = (locale: string, dataPath: string) =>
  dataPath.replace("/data/", `/locales/${locale}/`);

export const prettify = (slug: string) => {
  const words = slug.replace(/-+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * Loads every content pack and the texts for `locales`, in priority order
 * (e.g. `["it", "en"]`: Italian where translated, English otherwise).
 */
export async function loadContent(
  locales: string[],
  userPacks: UserPackRecord[] = [],
): Promise<Content> {
  const texts = new Map<string, string>();
  const packs: Pack[] = [];

  await Promise.all(
    Object.entries(packFiles).map(async ([path, load]) => {
      const pack = parsePack(await load());
      packs.push(pack);
      const idBySlug = new Map(pack.entries.map((e) => [e.id.split("/")[1] ?? "", e.id]));

      // Lowest priority first, so higher-priority locales overwrite.
      for (const locale of [...locales].reverse()) {
        const loadStrings = stringFiles[localePath(locale, path)];
        if (!loadStrings) continue;
        for (const [key, value] of Object.entries(await loadStrings())) {
          const dot = key.indexOf(".");
          const id = idBySlug.get(key.slice(0, dot));
          if (id && value) texts.set(`${id}.${key.slice(dot + 1)}`, value);
        }
      }
    }),
  );

  // Packs the user added: their texts are keyed by full entry id and carry their own language.
  for (const record of userPacks) {
    const pack = parsePack(record.pack);
    if (packs.some((p) => p.manifest.id === pack.manifest.id)) continue;
    packs.push(pack);
    for (const [key, value] of Object.entries(record.strings)) if (value) texts.set(key, value);
  }

  const text = (id: string, field: string) => texts.get(`${id}.${field}`);
  return {
    packs,
    index: indexPacks(...packs),
    text,
    name: (id) => text(id, "name") ?? prettify(id.split("/")[1] ?? id),
  };
}
