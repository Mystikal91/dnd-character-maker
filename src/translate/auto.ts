import { signal } from "@preact/signals";
import { dbClear, dbEntries, dbGet, dbPut } from "../storage/db";
import {
  type Connection,
  DEEPL_TARGETS,
  DEFAULT_RELAY,
  TranslateError,
  type TranslateProblem,
} from "./deepl";
import { type Engine, RANK, bestEngine, translateBatch } from "./engines";

export interface AutoSettings {
  enabled: boolean;
  relay: string;
  key: string;
  /** Leave names alone: a few words without context come out worst. */
  descriptionsOnly: boolean;
  /** Translate again, with a better engine, the texts a weaker one translated. */
  upgrade: boolean;
}

const STORAGE_KEY = "autoTranslate";

function readSettings(): AutoSettings {
  const blank = {
    enabled: false,
    relay: DEFAULT_RELAY,
    key: "",
    descriptionsOnly: true,
    upgrade: true,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved === "object")
      return {
        enabled: saved.enabled === true,
        relay: typeof saved.relay === "string" && saved.relay ? saved.relay : DEFAULT_RELAY,
        key: typeof saved.key === "string" ? saved.key : "",
        descriptionsOnly: saved.descriptionsOnly !== false,
        upgrade: saved.upgrade !== false,
      };
  } catch {
    // Storage may be refused or hold something else: start blank.
  }
  return blank;
}

/** The person's own choices: on or off, which relay, which DeepL key. Kept on this device. */
export const autoSettings = signal<AutoSettings>(readSettings());

export function saveAutoSettings(next: AutoSettings): void {
  autoSettings.value = next;
  failed.clear();
  autoError.value = undefined;
  translationTick.value++;
  refreshImprovable();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore: the choice just won't persist.
  }
  void flushSoon();
}

/** The language to translate into: the app's language, or nothing while it is English. */
export const autoTarget = signal<string | undefined>(undefined);

/** Counts the translations that arrived, so what shows them draws again. */
export const translationTick = signal(0);

/** Entries whose texts the person asked to read in English (the name goes with the description). */
const originals = signal<ReadonlySet<string>>(new Set());

/** The last problem, shown on the settings page. */
export const autoError = signal<TranslateProblem | undefined>(undefined);
export const pendingCount = signal(0);
export const cachedCount = signal(0);
/** How many saved translations a better engine than the one that made them could redo. */
export const improvableCount = signal(0);

// A translation is looked up by the target language and the exact English text.
const cache = new Map<string, string>();
/**
 * Who made the translations that DeepL did not (the relay's free one, MyMemory), by the same key.
 * A translation with no mark came from DeepL: they all did before there was a choice, and the
 * files that move between devices carry only the texts.
 */
const engines = new Map<string, Engine>();
const ENGINES_KEY = "translationEngines";
const engineOf = (ck: string): Engine => engines.get(ck) ?? "deepl";

/** How many of the saved translations could be made better with the engine the person has now. */
function refreshImprovable(): void {
  const best = RANK[bestEngine(autoSettings.value.key)];
  let n = 0;
  for (const ck of cache.keys()) if (RANK[engineOf(ck)] < best) n += 1;
  improvableCount.value = n;
}

function saveEngines(): void {
  void dbPut("meta", Object.fromEntries(engines), ENGINES_KEY).catch(() => undefined);
}

/** A text that arrived by another way (a file from another device) is taken as DeepL's. */
export function forgetEngines(keys: Iterable<string>): void {
  for (const key of keys) engines.delete(key);
  saveEngines();
}
const pending = new Map<string, { text: string; target: string; upgrade?: boolean }>();
const failed = new Set<string>();
/** What each shown text came from: the English it replaces, or the translation it can swap to. */
const shown = new Map<string, { key: string; mode: "translated" | "original" }>();

const cacheKey = (target: string, text: string) => `${target}\n${text}`;

/** The entry a text belongs to: `<entry id>.<field>` without its field. */
const entryOf = (key: string) => (key.includes(".") ? key.slice(0, key.indexOf(".")) : key);

/**
 * The fields left alone when only descriptions are wanted: names, which lose their context.
 * Short texts like a casting time or a range translate well, and repeat so often that they cost
 * little.
 */
const SHORT_FIELDS = new Set(["name"]);

const fieldOf = (key: string) => key.slice(key.lastIndexOf(".") + 1);

/** Worth sending to DeepL: it holds letters, and is not something like a bare number or dice. */
function worthTranslating(text: string): boolean {
  return /\p{L}{3,}/u.test(text);
}

/**
 * What `autoText` shows right now, without asking for a translation: the translation if one is
 * kept and not switched back to the English original, otherwise the text itself.
 */
export function displayedText(key: string, source: string): string {
  const settings = autoSettings.value;
  const target = autoTarget.value;
  translationTick.value;
  if (!settings.enabled || !target || !worthTranslating(source)) return source;
  if (settings.descriptionsOnly && SHORT_FIELDS.has(fieldOf(key))) return source;
  const hit = cache.get(cacheKey(target, source));
  return hit === undefined || originals.value.has(entryOf(key)) ? source : hit;
}

/** The translation of an English text if there is one; otherwise the text, and one is asked for. */
export function autoText(key: string, source: string): string {
  const settings = autoSettings.value;
  const target = autoTarget.value;
  translationTick.value;
  const asked = originals.value;
  if (!settings.enabled || !target || !worthTranslating(source)) return source;
  if (settings.descriptionsOnly && SHORT_FIELDS.has(fieldOf(key))) return source;

  const ck = cacheKey(target, source);
  const hit = cache.get(ck);
  if (hit !== undefined) {
    if (asked.has(entryOf(key))) {
      shown.set(source, { key, mode: "original" });
      return source;
    }
    shown.set(hit, { key, mode: "translated" });
    // A text a weaker engine translated is done again, now that a better one can be had: only
    // the ones that are read, so nothing is spent on what nobody opens.
    if (
      settings.upgrade &&
      RANK[engineOf(ck)] < RANK[bestEngine(settings.key)] &&
      !failed.has(ck) &&
      !pending.has(ck)
    ) {
      pending.set(ck, { text: source, target, upgrade: true });
      pendingCount.value = pending.size;
      void flushSoon();
    }
    return hit;
  }
  if (!failed.has(ck) && !pending.has(ck)) {
    pending.set(ck, { text: source, target });
    pendingCount.value = pending.size;
    void flushSoon();
  }
  return source;
}

/** For a text on screen: whether it is a machine translation (or its English, to swap back). */
export function machineMode(
  text: string,
): { key: string; mode: "translated" | "original" } | undefined {
  translationTick.value;
  originals.value;
  return shown.get(text);
}

/** Swaps an entry's texts, its name included, between the translation and the English. */
export function toggleOriginal(key: string): void {
  const entry = entryOf(key);
  const next = new Set(originals.value);
  if (next.has(entry)) next.delete(entry);
  else next.add(entry);
  originals.value = next;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let flushing = false;

function flushSoon(): Promise<void> {
  clearTimeout(timer);
  return new Promise((resolve) => {
    timer = setTimeout(() => {
      void flush().finally(resolve);
    }, 250);
  });
}

const MAX_TEXTS = 40;
const MAX_CHARS = 20000;

async function flush(): Promise<void> {
  const settings = autoSettings.value;
  if (flushing || !settings.enabled || pending.size === 0) return;
  flushing = true;
  const connection: Connection = { relay: settings.relay, key: settings.key };
  try {
    while (pending.size > 0) {
      const target = pending.values().next().value?.target;
      if (!target) break;
      const batch: [string, string][] = [];
      let chars = 0;
      for (const [ck, item] of pending) {
        if (item.target !== target) continue;
        if (batch.length >= MAX_TEXTS || (batch.length > 0 && chars + item.text.length > MAX_CHARS))
          break;
        batch.push([ck, item.text]);
        chars += item.text.length;
      }
      let result: string[];
      let engine: Engine;
      let skipped: TranslateProblem | undefined;
      try {
        const translated = await translateBatch(
          connection,
          batch.map(([, text]) => text),
          target,
        );
        result = translated.texts;
        engine = translated.engine;
        skipped = translated.skipped;
      } catch (error) {
        for (const [ck] of batch) {
          pending.delete(ck);
          failed.add(ck);
        }
        autoError.value = error instanceof TranslateError ? error.problem : "failed";
        // A refused key or an exhausted allowance will not get better by trying the rest.
        if (error instanceof TranslateError && error.status !== undefined) pending.clear();
        pendingCount.value = pending.size;
        translationTick.value++;
        return;
      }
      // A key that was refused, or used up, is worth telling even while the free engines help.
      autoError.value = connection.key.trim() ? skipped : undefined;
      batch.forEach(([ck], i) => {
        const text = result[i] ?? "";
        const upgrade = pending.get(ck)?.upgrade === true;
        pending.delete(ck);
        if (!text) return;
        // An improvement that is no better than what is kept is not kept, nor asked for again.
        if (upgrade && RANK[engine] <= RANK[engineOf(ck)]) {
          failed.add(ck);
          return;
        }
        cache.set(ck, text);
        if (engine === "deepl") engines.delete(ck);
        else engines.set(ck, engine);
        void dbPut("translations", text, ck).catch(() => undefined);
      });
      saveEngines();
      refreshImprovable();
      cachedCount.value = cache.size;
      pendingCount.value = pending.size;
      translationTick.value++;
    }
  } finally {
    flushing = false;
  }
}

/** Reads the translations kept on this device. */
export async function loadTranslationCache(): Promise<void> {
  try {
    for (const [key, value] of await dbEntries<string>("translations")) cache.set(key, value);
    const marks = await dbGet<Record<string, Engine> | undefined>("meta", ENGINES_KEY);
    engines.clear();
    for (const [key, engine] of Object.entries(marks ?? {}))
      if (cache.has(key) && engine in RANK) engines.set(key, engine);
  } catch {
    // Storage may be unavailable: translations then live only until the page closes.
  }
  cachedCount.value = cache.size;
  refreshImprovable();
  translationTick.value++;
}

/** Forgets every saved translation. */
export async function clearTranslationCache(): Promise<void> {
  cache.clear();
  engines.clear();
  saveEngines();
  failed.clear();
  shown.clear();
  cachedCount.value = 0;
  improvableCount.value = 0;
  try {
    await dbClear("translations");
  } catch {
    // Nothing more to do.
  }
  translationTick.value++;
}

export const canTranslate = (language: string) => language in DEEPL_TARGETS;
