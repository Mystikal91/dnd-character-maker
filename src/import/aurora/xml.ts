/** Small helpers for reading Aurora's XML: text, descriptions, setters and numbers. */

export class AuroraParseError extends Error {}

export const slugify = (text: string): string =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/['’`]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const clean = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

/**
 * The text of an element. A label written as a span (`<span class="feature">Speed.</span>Your...`)
 * has no space after it in the files, so one is put there; a line break is a space.
 */
function plainText(node: Node): string {
  if (node.nodeType === 3) return node.textContent ?? "";
  if (node.nodeType !== 1) return "";
  const el = node as Element;
  const inner = Array.from(el.childNodes).map(plainText).join("");
  const tag = el.tagName.toLowerCase();
  if (tag === "br") return " ";
  return tag === "span" && /\bfeature\b/.test(el.getAttribute("class") ?? "") ? `${inner} ` : inner;
}

/** The visible text of a description: paragraphs, with list items as `- item`. */
export function paragraphs(description: Element | null | undefined): string[] {
  if (!description) return [];
  const out: string[] = [];
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag === "p") out.push(clean(plainText(child)));
      else if (tag === "ul" || tag === "ol")
        for (const li of Array.from(child.children)) out.push(`- ${clean(plainText(li))}`);
      else if (tag === "table")
        continue; // tables do not survive as plain text
      else walk(child);
    }
  };
  walk(description);
  return out.filter((p) => p !== "" && p !== "- ");
}

export interface Setter {
  text: string;
  attrs: Element;
}

/** The `<set name="...">` values of an element, by name. */
export function setters(element: Element): Map<string, Setter> {
  const found = new Map<string, Setter>();
  for (const set of Array.from(element.querySelectorAll(":scope > setters > set"))) {
    const name = set.getAttribute("name");
    if (name && !found.has(name)) found.set(name, { text: clean(set.textContent), attrs: set });
  }
  return found;
}

export const description = (element: Element): string =>
  paragraphs(element.querySelector(":scope > description")).join("\n\n");

export const number = (text: string): number | undefined => {
  const n = Number.parseFloat(text.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

/** Cost in copper, silver or gold: electrum and platinum are converted. */
export function parseCost(set: Setter | undefined) {
  const amount = number(set?.text ?? "");
  if (amount === undefined) return { amount: 0, unit: "gp" as const };
  const currency = set?.attrs.getAttribute("currency")?.toLowerCase() ?? "gp";
  if (currency === "cp" || currency === "sp" || currency === "gp")
    return { amount, unit: currency };
  if (currency === "ep") return { amount: amount * 5, unit: "sp" as const };
  if (currency === "pp") return { amount: amount * 10, unit: "gp" as const };
  return { amount, unit: "gp" as const };
}

export function parseWeight(set: Setter | undefined): number | undefined {
  const lb = set?.attrs.getAttribute("lb");
  return lb ? number(lb) : number(set?.text ?? "");
}

/** `ID_X, ID_Y` or `A, B` lists written in `supports`. */
export const supportsOf = (element: Element): string[] =>
  clean(element.querySelector(":scope > supports")?.textContent)
    .split(/\s*,\s*/)
    .filter(Boolean);
