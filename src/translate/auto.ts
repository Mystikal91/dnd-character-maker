import { signal } from "@preact/signals";
import { dbClear, dbEntries, dbPut } from "../storage/db";
import {
  type Connection,
  DEEPL_TARGETS,
  DEFAULT_RELAY,
  TranslateError,
  type TranslateProblem,
  translateTexts,
} from "./deepl";

export interface AutoSettings {
  enabled: boolean;
  relay: string;
  key: string;
}

const STORAGE_KEY = "autoTranslate";

function readSettings(): AutoSettings {
  const blank = { enabled: false, relay: DEFAULT_RELAY, key: "" };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved === "object")
      return {
        enabled: saved.enabled === true,
        relay: typeof saved.relay === "string" && saved.relay ? saved.relay : DEFAULT_RELAY,
        key: typeof saved.key === "string" ? saved.key : "",
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

// A translation is looked up by the target language and the exact English text.
const cache = new Map<string, string>();
const pending = new Map<string, { text: string; target: string }>();
const failed = new Set<string>();
/** What each shown text came from: the English it replaces, or the translation it can swap to. */
const shown = new Map<string, { key: string; mode: "translated" | "original" }>();

const cacheKey = (target: string, text: string) => `${target}\n${text}`;

/** The entry a text belongs to: `<entry id>.<field>` without its field. */
const entryOf = (key: string) => (key.includes(".") ? key.slice(0, key.indexOf(".")) : key);

/** Worth sending to DeepL: it holds letters, and is not something like a bare number or dice. */
function worthTranslating(text: string): boolean {
  return /\p{L}{3,}/u.test(text);
}

/** The translation of an English text if there is one; otherwise the text, and one is asked for. */
export function autoText(key: string, source: string): string {
  const settings = autoSettings.value;
  const target = autoTarget.value;
  translationTick.value;
  const asked = originals.value;
  if (!settings.enabled || !settings.key || !target || !worthTranslating(source)) return source;

  const ck = cacheKey(target, source);
  const hit = cache.get(ck);
  if (hit !== undefined) {
    if (asked.has(entryOf(key))) {
      shown.set(source, { key, mode: "original" });
      return source;
    }
    shown.set(hit, { key, mode: "translated" });
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
  if (flushing || !settings.enabled || !settings.key || pending.size === 0) return;
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
      try {
        result = await translateTexts(
          connection,
          batch.map(([, text]) => text),
          target,
        );
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
      autoError.value = undefined;
      batch.forEach(([ck], i) => {
        const text = result[i] ?? "";
        pending.delete(ck);
        if (!text) return;
        cache.set(ck, text);
        void dbPut("translations", text, ck).catch(() => undefined);
      });
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
  } catch {
    // Storage may be unavailable: translations then live only until the page closes.
  }
  cachedCount.value = cache.size;
  translationTick.value++;
}

/** Forgets every saved translation. */
export async function clearTranslationCache(): Promise<void> {
  cache.clear();
  failed.clear();
  shown.clear();
  cachedCount.value = 0;
  try {
    await dbClear("translations");
  } catch {
    // Nothing more to do.
  }
  translationTick.value++;
}

export const canTranslate = (language: string) => language in DEEPL_TARGETS;
