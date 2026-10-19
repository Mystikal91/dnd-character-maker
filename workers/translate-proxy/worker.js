/**
 * A tiny relay between DND Character Maker and the DeepL API.
 *
 * DeepL does not let web pages call its API directly (it sends no CORS headers), so the app
 * sends its translation requests here and this worker passes them on. It keeps nothing: the
 * person's DeepL key arrives in the request, is forwarded to DeepL and is forgotten.
 *
 * It only relays two calls, so it cannot be used as an open proxy:
 *   POST /v2/translate   translate texts
 *   GET  /v2/usage       how much of the monthly allowance is used
 *
 * Settings (all optional), in the Cloudflare dashboard under Settings > Variables:
 *   ALLOWED_ORIGINS   comma separated list of the sites that may use this relay.
 *                     Default: the published app and the local dev server.
 */

const DEFAULT_ORIGINS = ["https://mystikal91.github.io", "http://localhost:5173"];
const MAX_BODY_BYTES = 128 * 1024;
const MAX_TEXTS = 50;
const ROUTES = { "/v2/translate": "POST", "/v2/usage": "GET" };

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
