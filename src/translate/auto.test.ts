import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  autoError,
  autoSettings,
  autoTarget,
  autoText,
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
    });

    const text = "Roll twice and take the better result";
    expect(autoText("b.desc", text)).toBe(text);
    expect(autoText("c.desc", text)).toBe(text); // the same text asked by another place
    await vi.advanceTimersByTimeAsync(300);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1].body)).text).toEqual([text]);
    expect(autoText("b.desc", text)).toBe(`IT ${text}`);
    expect(machineMode(`IT ${text}`)).toEqual({ key: "b.desc", mode: "translated" });

    // The name of the same entry is translated too, and swaps together with the description.
    expect(autoText("b.name", "Spell Name")).toBe("Spell Name");
    await vi.advanceTimersByTimeAsync(300);
    expect(autoText("b.name", "Spell Name")).toBe("IT Spell Name");

    toggleOriginal("b.desc");
    expect(autoText("b.desc", text)).toBe(text);
    expect(autoText("b.name", "Spell Name")).toBe("Spell Name");
    expect(machineMode(text)).toEqual({ key: "b.desc", mode: "original" });
    toggleOriginal("b.desc");
    expect(autoText("b.desc", text)).toBe(`IT ${text}`);
    expect(autoText("b.name", "Spell Name")).toBe("IT Spell Name");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("leaves names and other short fields in English when only descriptions are asked for", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) =>
      answer(JSON.parse(String(init.body)).text),
    );
    vi.stubGlobal("fetch", fetchMock);
    saveAutoSettings({
      enabled: true,
      relay: "https://relay.example",
      key: "k:fx",
      descriptionsOnly: true,
    });

    expect(autoText("d.name", "Fireball Storm")).toBe("Fireball Storm");
    expect(autoText("d.range", "Self (60-foot cone)")).toBe("Self (60-foot cone)");
    const text = "A bright streak flashes from your finger";
    expect(autoText("d.desc", text)).toBe(text);
    await vi.advanceTimersByTimeAsync(300);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1].body)).text).toEqual([text]);
    expect(autoText("d.desc", text)).toBe(`IT ${text}`);
    expect(autoText("d.name", "Fireball Storm")).toBe("Fireball Storm");
  });

  it("does not send what is not words, and stops when the key is refused", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    saveAutoSettings({
      enabled: true,
      relay: "https://relay.example",
      key: "bad",
      descriptionsOnly: false,
    });

    expect(autoText("d.desc", "1d8 + 2")).toBe("1d8 + 2");
    expect(autoText("e.desc", "A text that will be refused")).toBe("A text that will be refused");
    await vi.advanceTimersByTimeAsync(300);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(autoError.value).toBe("refused");
    expect(autoSettings.value.key).toBe("bad");

    // Asking again does not hit the relay again until the settings change.
    autoText("e.desc", "A text that will be refused");
    await vi.advanceTimersByTimeAsync(300);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
