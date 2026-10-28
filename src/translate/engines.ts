import {
  type Connection,
  DEEPL_TARGETS,
  TranslateError,
  type TranslateProblem,
  translateTexts,
} from "./deepl";

type Fetcher = (url: string) => Promise<Response>;

/** The longest piece MyMemory takes is 500 bytes: accents and quotes can take two. */
const MYMEMORY_PIECE = 380;

/** Cuts a text at the ends of sentences into pieces of at most `max` letters. */
export function splitText(text: string, max: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\n{2,}/)) {
    let current = "";
    for (const sentence of paragraph.split(/(?<=[.!?;:])\s+/)) {
      for (let at = 0; at < sentence.length || at === 0; at += max) {
        const part = sentence.slice(at, at + max);
        if (current && current.length + part.length + 1 > max) {
          out.push(current);
          current = part;
        } else current = current ? `${current} ${part}` : part;
      }
    }
    out.push(current);
  }
  return out;
}

/**
 * MyMemory, which asks for no account and no key: about five thousand letters a day for each
 * person. The last resort when the relay and DeepL have nothing to give.
 */
export async function translateMyMemory(
  texts: string[],
  target: string,
  fetcher: Fetcher = (url) => fetch(url),
): Promise<string[]> {
  const code = DEEPL_TARGETS[target]?.toLowerCase();
  if (!code) throw new TranslateError("language");
  const piece = async (part: string): Promise<string> => {
    if (!/\p{L}{2,}/u.test(part)) return part;
    let response: Response;
    try {
      response = await fetcher(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(part)}&langpair=en|${code}`,
      );
    } catch {
      throw new TranslateError("unreachable");
    }
    if (!response.ok) throw new TranslateError(response.status === 429 ? "quota" : "failed");
    const answer = (await response.json()) as {
      responseStatus?: number | string;
      responseData?: { translatedText?: string };
    };
    const text = answer.responseData?.translatedText ?? "";
    if (Number(answer.responseStatus) === 429 || /^MYMEMORY WARNING/i.test(text))
      throw new TranslateError("quota");
    if (Number(answer.responseStatus) !== 200 || !text) throw new TranslateError("failed");
    return text;
  };
  const out: string[] = [];
  for (const text of texts) {
    const parts = splitText(text, MYMEMORY_PIECE);
    const done: string[] = [];
    for (const part of parts) done.push(await piece(part));
    out.push(done.join("\n\n"));
  }
  return out;
}

/** Who translated: DeepL with the person's key, the relay's free translation, or MyMemory. */
export type Engine = "deepl" | "relay" | "memory";

/** How good each is taken to be: a text is improved when a better one is at hand. */
export const RANK: Record<Engine, number> = { memory: 1, relay: 2, deepl: 3 };

/** The best engine the person can reach now: DeepL with a key, else the relay's own. */
export const bestEngine = (key: string): Engine => (key.trim() ? "deepl" : "relay");

/** What the engines said, so the settings page can name the first one that had a problem. */
export interface Translated {
  texts: string[];
  /** Which engine made them. */
  engine: Engine;
  /** The problem of the engine tried first, if it failed and another one took over. */
  skipped?: TranslateProblem;
}

/**
 * Translates with the best engine at hand: DeepL if the person gave a key, then the relay's free
 * translation, then MyMemory. The first failure is the one worth telling the person about.
 */
export async function translateBatch(
  connection: Connection,
  texts: string[],
  target: string,
  engines: {
    relay: typeof translateTexts;
    memory: typeof translateMyMemory;
  } = { relay: translateTexts, memory: translateMyMemory },
): Promise<Translated> {
  const steps: [Engine, () => Promise<string[]>][] = [];
  if (connection.key.trim()) steps.push(["deepl", () => engines.relay(connection, texts, target)]);
  steps.push(["relay", () => engines.relay({ relay: connection.relay, key: "" }, texts, target)]);
  steps.push(["memory", () => engines.memory(texts, target)]);
  let first: TranslateError | undefined;
  for (const [engine, step] of steps) {
    try {
      const result = await step();
      return { texts: result, engine, ...(first && { skipped: first.problem }) };
    } catch (error) {
      const problem = error instanceof TranslateError ? error : new TranslateError("failed");
      // A language none of them offers is not a reason to try the next.
      if (problem.problem === "language") throw problem;
      first ??= problem;
    }
  }
  throw first ?? new TranslateError("failed");
}
