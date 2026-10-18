/**
 * Builds `data/srd51/*.json` (content packs) and `locales/en/srd51/*.json` (English strings)
 * from the pinned 5e-database source. Usage: `npm run data:srd51`.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type Pack, findBrokenReferences, parsePack } from "../../src/data/schema";
import { type RawSource, convertAll } from "./convert";
import { CACHE_DIR, fetchSource } from "./fetch";
import source from "./source.json" with { type: "json" };

const ATTRIBUTION =
  "This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.";

const FILE_NAMES = {
  species: "species",
  subspecies: "subspecies",
  trait: "traits",
  background: "backgrounds",
  spell: "spells",
  class: "classes",
  subclass: "subclasses",
  feature: "features",
  item: "items",
  property: "properties",
  ability: "abilities",
  skill: "skills",
  language: "languages",
} as const;

const readJson = async (name: string) =>
  JSON.parse(await readFile(join(CACHE_DIR, `${name}.json`), "utf8"));

const write = (path: string, value: unknown) =>
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`);

await fetchSource();
const raw: RawSource = {
  races: await readJson("5e-SRD-Races"),
  subraces: await readJson("5e-SRD-Subraces"),
  traits: await readJson("5e-SRD-Traits"),
  backgrounds: await readJson("5e-SRD-Backgrounds"),
  spells: await readJson("5e-SRD-Spells"),
  proficiencies: await readJson("5e-SRD-Proficiencies"),
  languages: await readJson("5e-SRD-Languages"),
  classes: await readJson("5e-SRD-Classes"),
  subclasses: await readJson("5e-SRD-Subclasses"),
  levels: await readJson("5e-SRD-Levels"),
  features: await readJson("5e-SRD-Features"),
  equipment: await readJson("5e-SRD-Equipment"),
  weaponProperties: await readJson("5e-SRD-Weapon-Properties"),
  abilityScores: await readJson("5e-SRD-Ability-Scores"),
  skills: await readJson("5e-SRD-Skills"),
};

const converted = convertAll(raw);
const manifest = {
  id: "srd51",
  ruleset: "srd51",
  version: `5e-database@${source.databaseVersion}`,
  license: "CC-BY-4.0",
  attribution: ATTRIBUTION,
};

const dataDir = join("data", "srd51");
const localeDir = join("locales", "en", "srd51");
await mkdir(dataDir, { recursive: true });
await mkdir(localeDir, { recursive: true });

const packs: Pack[] = [];
for (const [kind, { entries, strings }] of Object.entries(converted)) {
  const file = FILE_NAMES[kind as keyof typeof FILE_NAMES];
  const pack = parsePack({ manifest, entries });
  packs.push(pack);
  await write(join(dataDir, `${file}.json`), pack);
  await write(join(localeDir, `${file}.json`), strings);
  console.log(`${file}: ${entries.length} entries, ${Object.keys(strings).length} strings`);
}

const broken = findBrokenReferences(packs);
if (broken.length) {
  // Class and item references appear once those categories are converted.
  console.warn(
    `${broken.length} unresolved references, e.g.:\n  ${broken.slice(0, 5).join("\n  ")}`,
  );
  process.exitCode = 1;
}
