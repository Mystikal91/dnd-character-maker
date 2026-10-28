import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  autoError,
  autoSettings,
  autoTarget,
  autoText,
  clearTranslationCache,
  displayedText,
  improvableCount,
  machineMode,
  saveAutoSettings,
  toggleOriginal,
} from "./auto";
import { TranslateError, fetchUsage, translateTexts } from "./deepl";

const connection = { relay: "https://relay.example/", key: "secret:fx" };

function answer(texts: string[]) {
  return new Response(JSON.stringify({ translations: texts.map((t) => ({ text: `IT ${t}` })) }));
}

describe("DeepL client", () => {
  it("sends the key, the language and the texts to the relay", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const result = await translateTexts(connection, ["Hello there"], "it", async (url, init) => {
      calls.push({ url, init });
      return answer(["Hello there"]);
    });
    expect(result).toEqual(["IT Hello there"]);
    expect(calls[0]?.url).toBe("https://relay.example/v2/translate");
    expect(new Headers(calls[0]?.init.headers).get("Authorization")).toBe(
      "DeepL-Auth-Key secret:fx",
    );
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({
      text: ["Hello there"],
      target_lang: "IT",
      source_lang: "EN",
    });
  });

  it("names the problem", async () => {
    const refuse = (status: number) => async () => new Response("{}", { status });
    await expect(translateTexts(connection, ["a"], "it", refuse(403))).rejects.toMatchObject({
      problem: "refused",
    });
    await expect(translateTexts(connection, ["a"], "it", refuse(456))).rejects.toMatchObject({
      problem: "quota",
    });
    await expect(
      translateTexts(connection, ["a"], "it", async () => {
        throw new Error("offline");
      }),
    ).rejects.toBeInstanceOf(TranslateError);
    await expect(translateTexts(connection, ["a"], "en", refuse(200))).rejects.toMatchObject({
      problem: "language",
    });
  });

  it("reads the usage", async () => {
    const usage = await fetchUsage(
      connection,
      async () => new Response(JSON.stringify({ character_count: 12, character_limit: 500000 })),
    );
    expect(usage).toEqual({ used: 12, limit: 500000 });
  });
});

describe("translating as texts are read", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    autoTarget.value = "it";
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    autoTarget.value = undefined;
    saveAutoSettings({
      enabled: false,
      relay: "https://relay.example",
      key: "",
      descriptionsOnly: true,
      upgrade: false,
    });
  });

  it("leaves texts alone until it is switched on", () => {
    expect(autoText("a.desc", "You can see in the dark")).toBe("You can see in the dark");
  });

  it("asks once, then serves the translation and can swap back", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) =>
      answer(JSON.parse(String(init.body)).text),
    );
    vi.stubGlobal("fetch", fetchMock);
    saveAutoSettings({
      enabled: true,
      relay: "https://relay.example",
      key: "k:fx",
      descriptionsOnly: false,
      upgrade: false,
    });

    const text = "Roll twice and take the better result";
    expect(autoText("b.desc", text)).toBe(text);
    expect(autoText("c.desc", text)).toBe(text); // the same text asked by another place
    await vi.advanceTimersByTimeAsync(300);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1].body)).text).toEqual([text]);
    expect(autoText("b.desc", text)).toBe(`IT ${text}`);
    expect(machineMode(`IT ${text}`)).toEqual({
      key: "b.desc",
      mode: "translated",
      engine: "deepl",
    });

    // The name of the same entry is translated too, and swaps together with the description.
    expect(autoText("b.name", "Spell Name")).toBe("Spell Name");
    await vi.advanceTimersByTimeAsync(300);
    expect(autoText("b.name", "Spell Name")).toBe("IT Spell Name");

    toggleOriginal("b.desc");
    expect(autoText("b.desc", text)).toBe(text);
    expect(autoText("b.name", "Spell Name")).toBe("Spell Name");
    expect(machineMode(text)).toEqual({ key: "b.desc", mode: "original", engine: "deepl" });
    toggleOriginal("b.desc");
    expect(autoText("b.desc", text)).toBe(`IT ${text}`);
    expect(autoText("b.name", "Spell Name")).toBe("IT Spell Name");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("leaves names in English when only descriptions are asked for", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) =>
      answer(JSON.parse(String(init.body)).text),
    );
    vi.stubGlobal("fetch", fetchMock);
    saveAutoSettings({
      enabled: true,
      relay: "https://relay.example",
      key: "k:fx",
      descriptionsOnly: true,
      upgrade: false,
    });

    expect(autoText("d.name", "Fireball Storm")).toBe("Fireball Storm");
    const text = "A bright streak flashes from your finger";
    expect(autoText("d.desc", text)).toBe(text);
    await vi.advanceTimersByTimeAsync(300);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1].body)).text).toEqual([text]);
    expect(autoText("d.desc", text)).toBe(`IT ${text}`);
    expect(autoText("d.name", "Fireball Storm")).toBe("Fireball Storm");
  });

  it("tells what is on screen without asking for anything", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) =>
      answer(JSON.parse(String(init.body)).text),
    );
    vi.stubGlobal("fetch", fetchMock);
    saveAutoSettings({
      enabled: true,
      relay: "https://relay.example",
      key: "k:fx",
      descriptionsOnly: false,
      upgrade: false,
    });

    const text = "Gain a bonus to your next roll";
    // Nothing kept yet: the English, and no request.
    expect(displayedText("e.desc", text)).toBe(text);
    await vi.advanceTimersByTimeAsync(300);
    expect(fetchMock).not.toHaveBeenCalled();

    expect(autoText("e.desc", text)).toBe(text);
    await vi.advanceTimersByTimeAsync(300);
    expect(displayedText("e.desc", text)).toBe(`IT ${text}`);
    toggleOriginal("e.desc");
    expect(displayedText("e.desc", text)).toBe(text);
    toggleOriginal("e.desc");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not send what is not words, and stops when every engine refuses", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    saveAutoSettings({
      enabled: true,
      relay: "https://relay.example",
      key: "bad",
      descriptionsOnly: false,
      upgrade: false,
    });

    expect(autoText("d.desc", "1d8 + 2")).toBe("1d8 + 2");
    expect(autoText("e.desc", "A text that will be refused")).toBe("A text that will be refused");
    await vi.advanceTimersByTimeAsync(300);
    // DeepL, then the free translation of the relay, then MyMemory: each tried once.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(autoError.value).toBe("refused");
    expect(autoSettings.value.key).toBe("bad");

    // Asking again does not hit anything again until the settings change.
    autoText("e.desc", "A text that will be refused");
    await vi.advanceTimersByTimeAsync(300);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  describe("with no key, and a better engine later", () => {
    const text = "A text that is read again and again";
    const settings = (key: string) => ({
      enabled: true,
      relay: "https://relay.example",
      key,
      descriptionsOnly: false,
      upgrade: true,
    });

    it("falls back to MyMemory, then improves the text once the relay can translate", async () => {
      let relayWorks = false;
      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("mymemory"))
          return new Response(
            JSON.stringify({ responseStatus: 200, responseData: { translatedText: "MM text" } }),
          );
        if (!relayWorks) return new Response("{}", { status: 503 });
        return answer(JSON.parse(String(init?.body)).text);
      });
      vi.stubGlobal("fetch", fetchMock);
      saveAutoSettings(settings(""));

      expect(autoText("m.desc", text)).toBe(text);
      await vi.advanceTimersByTimeAsync(300);
      expect(autoText("m.desc", text)).toBe("MM text");
      expect(machineMode("MM text")?.engine).toBe("memory");
      expect(improvableCount.value).toBe(1);

      // Reading it again does nothing while the relay still cannot translate...
      relayWorks = true;
      saveAutoSettings(settings(""));
      expect(autoText("m.desc", text)).toBe("MM text");
      await vi.advanceTimersByTimeAsync(300);
      // ...and with it, the text is translated again and the better one is kept.
      expect(autoText("m.desc", text)).toBe(`IT ${text}`);
      expect(improvableCount.value).toBe(0);
    });

    it("improves a text again when a DeepL key is added", async () => {
      await clearTranslationCache();
      const text = "Another text, read after a key was added";
      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        const texts = JSON.parse(String(init?.body)).text as string[];
        const deepl = url.endsWith("/v2/translate");
        return new Response(
          JSON.stringify({
            translations: texts.map((t) => ({ text: `${deepl ? "DL" : "FREE"} ${t}` })),
          }),
        );
      });
      vi.stubGlobal("fetch", fetchMock);
      saveAutoSettings(settings(""));
      expect(autoText("k.desc", text)).toBe(text);
      await vi.advanceTimersByTimeAsync(300);
      expect(autoText("k.desc", text)).toBe(`FREE ${text}`);
      expect(improvableCount.value).toBe(0);

      saveAutoSettings(settings("good:fx"));
      expect(improvableCount.value).toBe(1);
      expect(autoText("k.desc", text)).toBe(`FREE ${text}`);
      await vi.advanceTimersByTimeAsync(300);
      expect(autoText("k.desc", text)).toBe(`DL ${text}`);
      expect(machineMode(`DL ${text}`)?.engine).toBe("deepl");
      expect(improvableCount.value).toBe(0);
    });
  });
});
