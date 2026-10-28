import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { deeplHost, pieces } from "../workers/translate-proxy/worker.js";

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

  describe("free translation", () => {
    type Run = (
      model: string,
      input: Record<string, string>,
    ) => Promise<{ translated_text?: string }>;
    const withAi = (run: Run) => ({ AI: { run } });
    const ask = (env: ReturnType<typeof withAi> | undefined, body: unknown) =>
      worker.fetch(
        new Request("https://relay.example/v1/translate", {
          method: "POST",
          headers: { Origin: ORIGIN },
          body: JSON.stringify(body),
        }),
        env,
      );

    it("translates without a DeepL key, in the shape DeepL answers", async () => {
      const seen: Record<string, string>[] = [];
      const env = withAi(async (_model, input) => {
        seen.push(input);
        return { translated_text: `[it] ${input.text}` };
      });
      const response = await ask(env, { text: ["Hello", "12"], target_lang: "IT" });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        translations: [{ text: "[it] Hello" }, { text: "12" }],
      });
      expect(seen).toEqual([{ text: "Hello", source_lang: "en", target_lang: "it" }]);
    });

    it("tries the name of the language when the code is not taken", async () => {
      const env = withAi(async (_model, input) => {
        if (input.target_lang === "it") throw new Error("invalid language");
        return { translated_text: input.target_lang ?? "" };
      });
      const response = await ask(env, { text: ["Hello"], target_lang: "it" });
      expect(await response.json()).toEqual({ translations: [{ text: "italian" }] });
    });

    it("says so when it is not set up, when the allowance of the day is gone and for a language it lacks", async () => {
      expect((await ask(undefined, { text: ["a"], target_lang: "it" })).status).toBe(503);
      const gone = withAi(async () => {
        throw new Error("4006: you have used up your daily free allocation of 10,000 neurons");
      });
      expect((await ask(gone, { text: ["Hello"], target_lang: "it" })).status).toBe(456);
      const fine = withAi(async () => ({ translated_text: "x" }));
      expect((await ask(fine, { text: ["Hello"], target_lang: "ja" })).status).toBe(400);
      expect((await ask(fine, { text: "Hello", target_lang: "it" })).status).toBe(400);
    });

    it("cuts a long text at the ends of paragraphs and sentences", () => {
      const sentence = "A sentence that is a little long, to fill the piece up quickly. ";
      const long = sentence.repeat(30).trim();
      const parts = pieces(`First.\n\n${long}`);
      expect(parts[0]).toBe("First.");
      expect(parts.length).toBeGreaterThan(3);
      expect(parts.every((p) => p.length <= 640)).toBe(true);
      expect(parts.slice(1).join(" ")).toBe(long);
    });
  });
});
