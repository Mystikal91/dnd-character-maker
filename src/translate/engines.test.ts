import { describe, expect, it } from "vitest";
import { TranslateError } from "./deepl";
import { splitText, translateBatch, translateMyMemory } from "./engines";

const connection = { relay: "https://relay.example", key: "k:fx" };

describe("cutting a text for MyMemory", () => {
  it("cuts at the ends of sentences into pieces no longer than the limit", () => {
    const text = "One sentence is here. Another sentence follows it. A third one closes.";
    const parts = splitText(text, 30);
    expect(parts.every((p) => p.length <= 30)).toBe(true);
    expect(parts.join(" ")).toBe(text);
  });

  it("cuts a sentence that is longer than the limit by itself", () => {
    expect(splitText("a".repeat(70), 30).map((p) => p.length)).toEqual([30, 30, 10]);
  });
});

describe("MyMemory", () => {
  const reply =
    (body: unknown, status = 200) =>
    async () =>
      new Response(JSON.stringify(body), { status });

  it("translates and leaves what is not words alone", async () => {
    const seen: string[] = [];
    const out = await translateMyMemory(["Hello there", "1d8"], "it", async (url) => {
      seen.push(url);
      return new Response(
        JSON.stringify({ responseStatus: 200, responseData: { translatedText: "Ciao" } }),
      );
    });
    expect(out).toEqual(["Ciao", "1d8"]);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("langpair=en|it");
  });

  it("knows when the allowance of the day is gone", async () => {
    const warning = {
      responseStatus: 200,
      responseData: {
        translatedText: "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS",
      },
    };
    await expect(translateMyMemory(["Hello there"], "it", reply(warning))).rejects.toMatchObject({
      problem: "quota",
    });
    await expect(
      translateMyMemory(["Hello there"], "it", reply({ responseStatus: 429 })),
    ).rejects.toMatchObject({ problem: "quota" });
  });
});

describe("the engines in turn", () => {
  const fail = (problem: ConstructorParameters<typeof TranslateError>[0]) => async () => {
    throw new TranslateError(problem);
  };
  const relayWorks = (label: string) => async (_c: unknown, texts: string[]) =>
    texts.map((t) => `${label} ${t}`);
  const memoryWorks = (label: string) => async (texts: string[]) =>
    texts.map((t) => `${label} ${t}`);

  it("uses DeepL first, and says which engine did it", async () => {
    const result = await translateBatch(connection, ["a"], "it", {
      relay: relayWorks("relay"),
      memory: memoryWorks("memory"),
    });
    expect(result).toEqual({ texts: ["relay a"], engine: "deepl" });
  });

  it("goes on to the next engine, and tells what the first one said", async () => {
    let calls = 0;
    const relay = async (c: { key: string }, texts: string[]) => {
      calls += 1;
      if (c.key) throw new TranslateError("quota");
      return texts.map((t) => `free ${t}`);
    };
    const result = await translateBatch(connection, ["a"], "it", {
      relay: relay as never,
      memory: memoryWorks("memory"),
    });
    expect(result).toEqual({ texts: ["free a"], engine: "relay", skipped: "quota" });
    expect(calls).toBe(2);
  });

  it("ends with MyMemory, and gives the first problem when all fail", async () => {
    const memory = await translateBatch({ relay: connection.relay, key: "" }, ["a"], "it", {
      relay: fail("unreachable"),
      memory: memoryWorks("memory"),
    });
    expect(memory).toEqual({ texts: ["memory a"], engine: "memory", skipped: "unreachable" });
    await expect(
      translateBatch(connection, ["a"], "it", { relay: fail("refused"), memory: fail("quota") }),
    ).rejects.toMatchObject({ problem: "refused" });
  });

  it("does not try the others for a language that nobody offers", async () => {
    await expect(
      translateBatch(connection, ["a"], "ja", {
        relay: fail("language"),
        memory: memoryWorks("m"),
      }),
    ).rejects.toMatchObject({ problem: "language" });
  });
});
