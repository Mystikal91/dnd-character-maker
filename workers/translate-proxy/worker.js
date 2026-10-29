/**
 * A tiny relay between Heroquill and the DeepL API.
 *
 * DeepL does not let web pages call its API directly (it sends no CORS headers), so the app
 * sends its translation requests here and this worker passes them on. It keeps nothing: the
 * person's DeepL key arrives in the request, is forwarded to DeepL and is forgotten.
 *
 * It only relays two calls, so it cannot be used as an open proxy:
 *   POST /v2/translate   translate texts (with the person's DeepL key)
 *   GET  /v2/usage       how much of the monthly allowance is used
 *
 * And it can translate for people who have no DeepL key, with Cloudflare Workers AI (the free
 * allowance of the account, shared by everyone who uses the relay):
 *   POST /v1/translate   translate texts; needs the "Workers AI" binding named AI
 *
 * Settings (all optional), in the Cloudflare dashboard under Settings > Variables:
 *   ALLOWED_ORIGINS   comma separated list of the sites that may use this relay.
 *                     Default: the published app and the local dev server.
 */

const DEFAULT_ORIGINS = [
  "https://heroquill.app",
  "https://mystikal91.github.io",
  "http://localhost:5173",
];
const MAX_BODY_BYTES = 128 * 1024;
const MAX_TEXTS = 50;
const ROUTES = { "/v2/translate": "POST", "/v2/usage": "GET", "/v1/translate": "POST" };

/** The free translation: the model, the longest piece it is given, and how often one person may ask. */
const AI_MODEL = "@cf/meta/m2m100-1.2b";
const MAX_PIECE = 600;
const MAX_REQUESTS_PER_MINUTE = 30;
const LANGUAGES = { it: "italian", fr: "french", de: "german", es: "spanish" };

/** DeepL free keys end with ":fx" and use another host than the paid ones. */
export function deeplHost(key) {
  return key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
}

function allowedOrigins(env) {
  const list = env?.ALLOWED_ORIGINS;
  return list
    ? list
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : DEFAULT_ORIGINS;
}

function reply(body, status, origin) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers });
}

/** Cuts a text into pieces the model takes well: at paragraph ends, then at sentence ends. */
export function pieces(text) {
  const out = [];
  for (const paragraph of text.split(/\n{2,}/)) {
    if (paragraph.length <= MAX_PIECE) {
      out.push(paragraph);
      continue;
    }
    let current = "";
    for (const sentence of paragraph.split(/(?<=[.!?;:])\s+/)) {
      if (current && current.length + sentence.length + 1 > MAX_PIECE) {
        out.push(current);
        current = sentence;
      } else current = current ? `${current} ${sentence}` : sentence;
    }
    if (current) out.push(current);
  }
  return out;
}

/** The two ways the model has been documented to name a language: its code, then its name. */
let languageForm = "code";

const usedUp = (error) => /limit|quota|exceed|neuron/i.test(String(error?.message ?? error));

async function translatePiece(env, text, code) {
  if (!/\p{L}/u.test(text)) return text;
  const code2 = ["code", code];
  const name = ["name", LANGUAGES[code]];
  const forms = languageForm === "code" ? [code2, name] : [name, code2];
  let lastError;
  for (const [form, target] of forms) {
    try {
      const answer = await env.AI.run(AI_MODEL, {
        text,
        source_lang: form === "code" ? "en" : "english",
        target_lang: target,
      });
      const out = answer?.translated_text;
      if (typeof out === "string" && out) {
        languageForm = form;
        return out;
      }
    } catch (error) {
      lastError = error;
      // The allowance of the day is used up: another way of naming the language will not help.
      if (usedUp(error)) throw error;
    }
  }
  throw lastError ?? new Error("The model gave no translation.");
}

/** Who asked and when, in this instance of the worker: a light brake, not a guarantee. */
const recent = new Map();

function tooMany(request) {
  const who = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const now = Date.now();
  const times = (recent.get(who) ?? []).filter((t) => now - t < 60_000);
  times.push(now);
  recent.set(who, times);
  if (recent.size > 5000) recent.clear();
  return times.length > MAX_REQUESTS_PER_MINUTE;
}

async function freeTranslation(request, env, origin) {
  if (!env?.AI)
    return reply({ message: "Free translation is not set up on this relay." }, 503, origin);
  if (tooMany(request)) return reply({ message: "Too many requests." }, 429, origin);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return reply({ message: "Too much text." }, 413, origin);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return reply({ message: "The request is not JSON." }, 400, origin);
  }
  const target = String(parsed.target_lang ?? "").toLowerCase();
  if (!Array.isArray(parsed.text) || parsed.text.length < 1 || parsed.text.length > MAX_TEXTS)
    return reply({ message: `Send between 1 and ${MAX_TEXTS} texts.` }, 400, origin);
  if (!LANGUAGES[target]) return reply({ message: "This language is not offered." }, 400, origin);
  try {
    const translations = [];
    for (const original of parsed.text) {
      const parts = [];
      for (const piece of pieces(String(original)))
        parts.push(await translatePiece(env, piece, target));
      translations.push({ text: parts.join("\n\n") });
    }
    return reply({ translations }, 200, origin);
  } catch (error) {
    // 456 is what DeepL says for a used-up allowance, so the app treats both the same.
    if (usedUp(error))
      return reply({ message: "The free allowance of today is used up." }, 456, origin);
    return reply({ message: "The translation failed." }, 502, origin);
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") ?? "";
    if (!allowedOrigins(env).includes(origin)) {
      return new Response(JSON.stringify({ message: "This site may not use the relay." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (request.method === "OPTIONS") return reply(undefined, 204, origin);

    const path = new URL(request.url).pathname;
    if (ROUTES[path] !== request.method) return reply({ message: "Not found." }, 404, origin);
    if (path === "/v1/translate") return freeTranslation(request, env, origin);

    const auth = request.headers.get("Authorization") ?? "";
    const key = auth.replace(/^DeepL-Auth-Key\s+/i, "").trim();
    if (!key) return reply({ message: "The DeepL key is missing." }, 401, origin);

    let body;
    if (request.method === "POST") {
      body = await request.text();
      if (body.length > MAX_BODY_BYTES) return reply({ message: "Too much text." }, 413, origin);
      try {
        const parsed = JSON.parse(body);
        if (!Array.isArray(parsed.text) || parsed.text.length > MAX_TEXTS)
          return reply({ message: `Send between 1 and ${MAX_TEXTS} texts.` }, 400, origin);
      } catch {
        return reply({ message: "The request is not JSON." }, 400, origin);
      }
    }

    const response = await fetch(`${deeplHost(key)}${path}`, {
      method: request.method,
      headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
      body,
    });
    // DeepL's answer goes back as it is, with this site allowed to read it.
    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "application/json",
        "Access-Control-Allow-Origin": origin,
        Vary: "Origin",
      },
    });
  },
};
