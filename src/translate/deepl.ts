/** The address of the relay that passes requests on to DeepL (see docs/TRANSLATION_PROXY.md). */
export const DEFAULT_RELAY = "https://dnd-translate.mystikal91.workers.dev";

/** The languages the app can translate into, as DeepL writes them. */
export const DEEPL_TARGETS: Record<string, string> = {
  it: "IT",
  fr: "FR",
  de: "DE",
  es: "ES",
};

/** What went wrong, as a code the settings page turns into a sentence. */
export type TranslateProblem =
  | "unreachable"
  | "refused"
  | "limit"
  | "quota"
  | "failed"
  | "format"
  | "language";

export class TranslateError extends Error {
  constructor(
    readonly problem: TranslateProblem,
    readonly status?: number,
  ) {
    super(problem);
  }
}

export interface Connection {
  relay: string;
  key: string;
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

const clean = (relay: string) => relay.trim().replace(/\/+$/, "");

async function call(
  connection: Connection,
  path: string,
  init: { method: string; body?: unknown },
  fetcher: Fetcher,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(`${clean(connection.relay)}${path}`, {
      method: init.method,
      headers: {
        Authorization: `DeepL-Auth-Key ${connection.key.trim()}`,
        "Content-Type": "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new TranslateError("unreachable");
  }
  if (!response.ok) {
    const reason: Record<number, TranslateProblem> = {
      401: "refused",
      403: "refused",
      429: "limit",
      456: "quota",
    };
    throw new TranslateError(reason[response.status] ?? "failed", response.status);
  }
  return response.json();
}

/** Translates English texts into `target` (a language of `DEEPL_TARGETS`), in order. */
export async function translateTexts(
  connection: Connection,
  texts: string[],
  target: string,
  fetcher: Fetcher = (url, init) => fetch(url, init),
): Promise<string[]> {
  const code = DEEPL_TARGETS[target];
  if (!code) throw new TranslateError("language");
  const answer = (await call(
    connection,
    "/v2/translate",
    {
      method: "POST",
      body: { text: texts, target_lang: code, source_lang: "EN", preserve_formatting: true },
    },
    fetcher,
  )) as { translations?: { text?: string }[] };
  const out = answer.translations?.map((t) => t.text ?? "") ?? [];
  if (out.length !== texts.length) throw new TranslateError("format");
  return out;
}

/** How much of the monthly allowance is used. */
export async function fetchUsage(
  connection: Connection,
  fetcher: Fetcher = (url, init) => fetch(url, init),
): Promise<{ used: number; limit: number }> {
  const answer = (await call(connection, "/v2/usage", { method: "GET" }, fetcher)) as {
    character_count?: number;
    character_limit?: number;
  };
  return { used: answer.character_count ?? 0, limit: answer.character_limit ?? 0 };
}
