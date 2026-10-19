import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { deeplHost } from "../workers/translate-proxy/worker.js";

const ORIGIN = "https://mystikal91.github.io";

function call(
  path: string,
  init: { method?: string; origin?: string; key?: string; body?: unknown } = {},
) {
  const headers: Record<string, string> = { Origin: init.origin ?? ORIGIN };
  if (init.key) headers.Authorization = `DeepL-Auth-Key ${init.key}`;
  return worker.fetch(
    new Request(`https://relay.example${path}`, {
      method: init.method ?? "POST",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("translation relay", () => {
  it("picks the DeepL host from the key", () => {
    expect(deeplHost("abc:fx")).toBe("https://api-free.deepl.com");
    expect(deeplHost("abc")).toBe("https://api.deepl.com");
  });

  it("answers the browser's preflight and refuses other sites", async () => {
    const ok = await call("/v2/translate", { method: "OPTIONS" });
    expect(ok.status).toBe(204);
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect((await call("/v2/translate", { origin: "https://evil.example" })).status).toBe(403);
  });

  it("relays a translation to the free host and returns the answer", async () => {
    const seen: { url: string; auth: string | null }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      seen.push({ url, auth: new Headers(init.headers).get("Authorization") });
      return new Response(JSON.stringify({ translations: [{ text: "Ciao" }] }), { status: 200 });
    });
    const response = await call("/v2/translate", {
      key: "secret:fx",
      body: { text: ["Hello"], target_lang: "IT" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(await response.json()).toEqual({ translations: [{ text: "Ciao" }] });
    expect(seen).toEqual([
      { url: "https://api-free.deepl.com/v2/translate", auth: "DeepL-Auth-Key secret:fx" },
    ]);
  });

  it("is not an open proxy", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}"));
    expect((await call("/v2/glossaries", { key: "k:fx", body: { text: ["a"] } })).status).toBe(404);
    expect((await call("/v2/translate", { body: { text: ["a"] } })).status).toBe(401);
    expect((await call("/v2/translate", { key: "k:fx", body: { text: "a" } })).status).toBe(400);
    const many = Array.from({ length: 51 }, () => "a");
    expect((await call("/v2/translate", { key: "k:fx", body: { text: many } })).status).toBe(400);
    expect((await call("/v2/usage", { method: "GET", key: "k:fx" })).status).toBe(200);
  });
});
