// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { gatherAurora, rawAddress } from "./remote";

const elements = (name: string) =>
  `<elements><info><name>${name}</name></info><element name="${name}" type="Language" source="S" id="ID_${name}" /></elements>`;
const index = (...urls: string[]) =>
  `<index><info><name>Idx</name></info><files><obsolete name="old" url="https://x.test/old.xml" />${urls
    .map((u) => `<file name="f" url="${u}" />`)
    .join("")}</files></index>`;

const served =
  (files: Record<string, string>, log: string[] = []) =>
  async (url: string) => {
    log.push(url);
    const text = files[url];
    if (text === undefined) throw new Error("404");
    return text;
  };

describe("following Aurora indexes", () => {
  it("fetches nested indexes and their content files, skipping obsolete entries", async () => {
    const log: string[] = [];
    const files = {
      "https://x.test/core.index": index("https://x.test/a.index", "https://x.test/b.xml"),
      "https://x.test/a.index": index("https://x.test/c.xml"),
      "https://x.test/b.xml": elements("B"),
      "https://x.test/c.xml": elements("C"),
    };
    const result = await gatherAurora([{ text: index("https://x.test/core.index") }], {
      fetcher: served(files, log),
    });
    expect(result.texts).toHaveLength(2);
    expect(result.failed).toEqual([]);
    expect(log).not.toContain("https://x.test/old.xml");
  });

  it("starts from an address and visits each address once", async () => {
    const files = {
      "https://x.test/a.index": index("https://x.test/b.index", "https://x.test/b.index"),
      "https://x.test/b.index": index("https://x.test/a.index", "https://x.test/c.xml"),
      "https://x.test/c.xml": elements("C"),
    };
    const log: string[] = [];
    const result = await gatherAurora([{ url: "https://x.test/a.index" }], {
      fetcher: served(files, log),
    });
    expect(result.texts).toHaveLength(1);
    expect(log.sort()).toEqual([
      "https://x.test/a.index",
      "https://x.test/b.index",
      "https://x.test/c.xml",
    ]);
  });

  it("reports what could not be fetched and refuses addresses that are not https", async () => {
    const files = {
      "https://x.test/a.index": index("https://x.test/missing.xml", "http://x.test/plain.xml"),
    };
    const result = await gatherAurora([{ url: "https://x.test/a.index" }], {
      fetcher: served(files),
    });
    expect(result.texts).toEqual([]);
    expect(result.failed).toEqual(
      expect.arrayContaining(["https://x.test/missing.xml", "http://x.test/plain.xml"]),
    );
  });

  it("resolves relative addresses against the index and reads GitHub page addresses", async () => {
    const files = {
      "https://raw.githubusercontent.com/o/r/main/core/idx.index": index("book.xml"),
      "https://raw.githubusercontent.com/o/r/main/core/book.xml": elements("Book"),
    };
    const result = await gatherAurora(
      [{ url: "https://github.com/o/r/blob/main/core/idx.index" }],
      { fetcher: served(files) },
    );
    expect(result.texts).toHaveLength(1);
    expect(rawAddress("https://github.com/o/r/blob/main/a.xml")).toBe(
      "https://raw.githubusercontent.com/o/r/main/a.xml",
    );
  });
});
