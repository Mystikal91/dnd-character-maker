import { readFileSync } from "node:fs";
import { withOriginRules } from "../data/originRules";
import { type Pack, parsePack } from "../data/schema";
import { indexPacks } from "../engine/derive";

/** Loads the committed output of `npm run data:srd51` for tests; no network needed. */
export const SRD51_FILES = [
  "species",
  "subspecies",
  "traits",
  "backgrounds",
  "spells",
  "classes",
  "subclasses",
  "features",
  "items",
  "properties",
  "abilities",
  "skills",
  "languages",
  "proficiencies",
  "schools",
  "conditions",
  "alignments",
  "monsters",
] as const;

export function loadSrd51Pack(file: string): Pack {
  return withOriginRules(parsePack(JSON.parse(readFileSync(`data/srd51/${file}.json`, "utf8"))));
}

export function loadSrd51Strings(file: string): Record<string, string> {
  return JSON.parse(readFileSync(`locales/en/srd51/${file}.json`, "utf8"));
}

export const srd51Packs = SRD51_FILES.map(loadSrd51Pack);
export const srd51Index = indexPacks(...srd51Packs);
