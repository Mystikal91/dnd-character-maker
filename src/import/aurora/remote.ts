import { AuroraParseError } from "./xml";

/** Where the reader stops following index files: a safety net, not a rule about content. */
const MAX_FILES = 400;
const MAX_DEPTH = 6;
const PARALLEL = 6;

export interface Gathered {
  /** The content files found, ready for `parseAurora`. */
  texts: string[];
  /** Addresses that could not be fetched or were not Aurora files. */
  failed: string[];
  /** The name the first index file gives its content, when it has one. */
  title?: string;
  /** True when the limits stopped the search before every listed file was visited. */
  truncated: boolean;
}

export interface GatherOptions {
  fetcher?: (url: string) => Promise<string>;
  onProgress?: (done: number, total: number) => void;
}

interface Item {
  url?: string;
  text?: string;
  depth: number;
}

/** Turns a GitHub page address into the address of the raw file; other addresses stay as they are. */
export function rawAddress(input: string): string {
  const url = input.trim();
  const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
  return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}` : url;
}

async function download(url: string): Promise<string> {
  const response = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

/** The root element of an XML text and, for an index, the files it lists (obsolete ones left out). */
function inspect(text: string, base?: string): { root: string; listed: string[]; name: string } {
  const doc = new DOMParser().parseFromString(text.replace(/^﻿/, ""), "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0 || !doc.documentElement)
    return { root: "", listed: [], name: "" };
  const root = doc.documentElement.tagName;
  if (root !== "index") return { root, listed: [], name: "" };
  const name = (doc.querySelector("info > name")?.textContent ?? "").trim();
  const listed: string[] = [];
  for (const file of Array.from(doc.querySelectorAll("files > file"))) {
    const href = file.getAttribute("url");
    if (!href) continue;
    try {
      listed.push(rawAddress(new URL(href, base).href));
    } catch {
      // not an address: nothing to fetch
    }
  }
  return { root, listed, name };
}

/**
 * Follows Aurora index files, from text the user chose or from an address they typed, and
 * collects every content file they list. Only https addresses are fetched, and only after the
 * user gave the first file or address: nothing is fetched on its own.
 */
export async function gatherAurora(
  start: { text?: string; url?: string }[],
  options: GatherOptions = {},
): Promise<Gathered> {
  const fetcher = options.fetcher ?? download;
  const seen = new Set<string>();
  const texts: string[] = [];
  const failed: string[] = [];
  let truncated = false;
  let title: string | undefined;
  let done = 0;
  let total = 0;
  let level: Item[] = [];

  const enqueue = (given: Item, into: Item[]) => {
    let item = given;
    if (item.url) {
      const url = rawAddress(item.url);
      if (seen.has(url)) return;
      if (!url.startsWith("https://")) {
        failed.push(url);
        return;
      }
      if (seen.size >= MAX_FILES) {
        truncated = true;
        return;
      }
      seen.add(url);
      item = { ...given, url };
    }
    total++;
    into.push(item);
  };
  for (const s of start) enqueue({ ...s, depth: 0 }, level);

  while (level.length > 0) {
    const next: Item[] = [];
    for (let i = 0; i < level.length; i += PARALLEL) {
      await Promise.all(
        level.slice(i, i + PARALLEL).map(async (item) => {
          let text = item.text;
          try {
            text ??= await fetcher(item.url ?? "");
          } catch {
            failed.push(item.url ?? "");
          }
          done++;
          options.onProgress?.(done, total);
          if (text === undefined) return;
          const { root, listed, name } = inspect(text, item.url);
          if (root === "elements") texts.push(text);
          else if (root === "index") {
            if (name) title ??= name;
            if (item.depth >= MAX_DEPTH) truncated = true;
            else for (const url of listed) enqueue({ url, depth: item.depth + 1 }, next);
          } else failed.push(item.url ?? "file");
        }),
      );
    }
    level = next;
  }
  if (texts.length === 0 && failed.length === 0)
    throw new AuroraParseError("Nothing to import: no Aurora files found");
  return { texts, failed, truncated, ...(title && { title }) };
}
