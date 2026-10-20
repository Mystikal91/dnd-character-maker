# DND Character Maker

A free, offline-first web app to **build, play and print Dungeons & Dragons 5th edition
characters** with the SRD 5.1 rules. No server, no account, no tracking: your characters stay on
your device, and the app works without a connection once it has been opened.

**Use it:** <https://mystikal91.github.io/dnd-character-maker/>

> **Version 1.0 beta.** It works, but it needs more testing, so some numbers may be wrong in
> places. If something looks off, please [open an issue](https://github.com/Mystikal91/dnd-character-maker/issues).
> What is still missing is on the roadmap, inside the app (click the title).
>
> A note on how it was made: a lot of this project was written with the help of an AI assistant
> (Claude). It is a hobby project, made for fun and for my own table.

## What it does

**Build**

- A guided flow: species and subspecies, class and subclass, background, ability scores (standard
  array, point buy, rolled or manual), skills and other choices, spells, equipment and story.
- *Free edit*: override any number the rules would work out, and see what the automatic value
  would be.
- **Multiclassing** with the shared spell slots table, separate Pact Magic slots and the ability
  score prerequisites; **feats** in place of ability score improvements.
- **Level up**, from the Create or Play tabs: choose the class and the hit points, see exactly what
  changes, then jump to whatever is left to decide (subclass, ability scores, spells, choices).
  With a small celebration.

**Play**

- Hit points, temporary hit points, death saves, hit dice, short and long rests.
- Spell slots, Pact Magic, concentration (with the save to keep it), class resources (rage, ki,
  Channel Divinity, Bardic Inspiration...) and the numbers that matter at the table.
- Quick rolls for checks, saves, attacks and damage, with advantage and critical hits, a dice
  tray and a roll history. Conditions with their rules.

**Print and share**

- A character sheet, spell sheets and spell cards, for paper or PDF.
- Share a character as a **link, a QR code or a file**; a shared link opens the character on
  another device.

**Content**

- The whole SRD 5.1: classes, subclasses, species, backgrounds, spells, equipment and features.
- **Content packs** (footer, *Content packs*):
  - a **homebrew editor** for spells, weapons, armor, gear, languages, feats, species,
    backgrounds, classes and subclasses, with export and import of your packs;
  - an importer for **Aurora** XML files that you already have, by file, by index file (every file
    it lists is fetched) or by address. Nothing from Aurora or any publisher is bundled.
  - see [docs/CONTENT_PACKS.md](docs/CONTENT_PACKS.md).

**Languages and look**

- English, Italian, French, German and Spanish, with the **official SRD translations** (about 87%
  of the rules texts). Missing texts show in English; translations are managed with Weblate (see
  [docs/TRANSLATING.md](docs/TRANSLATING.md)).
- **Automatic translation** (footer): with your own DeepL key, texts that have no translation yet
  (and the English content you imported) are translated as you read them, marked as such, with a
  button for the original. Translations are cached on your device. DeepL does not accept calls
  from web pages, so requests go through a small relay; see
  [docs/TRANSLATION_PROXY.md](docs/TRANSLATION_PROXY.md) to run your own.
- Two styles (Fantasy and Modern), light and dark, and **feet or meters** (automatic by language).

## Development

```bash
npm install
npm run dev        # start the dev server
npm test           # unit tests
npm run lint       # Biome lint + format check
npm run format     # fix what Biome can
npm run typecheck  # TypeScript
npm run build      # type-check and production build into dist/
```

Node 20+ is required (the PWA build step fails on older versions); Node 22 is used in CI. The
site is published to GitHub Pages by the workflow in `.github/workflows/`.

| Command | What it does |
|---------|--------------|
| `npm run data:srd51` | Rebuilds `data/srd51/` and `locales/en/srd51/` from the pinned 5e-database source |

The scripts in `scripts/srd-translations/` (Python, PyMuPDF) import the official SRD
translations from their PDFs into `locales/`; see [docs/TRANSLATING.md](docs/TRANSLATING.md).

### Project layout

| Path | Purpose |
|------|---------|
| `src/engine/` | Rules engine: pure TypeScript, no UI dependencies (derived sheet, multiclass, level up, play state, spells) |
| `src/data/` | Schemas of the content packs and of class progression |
| `src/content/` | Loading the packs and their texts; the roadmap and changelog |
| `src/import/aurora/` | The Aurora XML reader |
| `src/homebrew/` | The homebrew editor's model (forms to pack entries and back) |
| `src/translate/` | Automatic translation: DeepL client, cache and queue |
| `src/storage/` | IndexedDB: characters, packs, saved translations; sharing links |
| `src/app/` | App state (signals): character, navigation, language, theme, units |
| `src/ui/` | Preact components and styles |
| `data/srd51/`, `locales/` | The SRD 5.1 content and its texts, by language |
| `workers/translate-proxy/` | The Cloudflare Worker that relays DeepL requests |
| `docs/` | Guides: translating, content packs, the translation relay |

The stack is Vite, Preact with signals, strict TypeScript, valibot, Biome, Vitest and
vite-plugin-pwa.

## Versions and changelog

The version and its stage (`beta`) are in `src/app/version.ts`. What changed in each version is
listed in `src/content/news.ts` (`CHANGELOG`, newest first: write the lines in English and, if
possible, in the other languages) next to the `ROADMAP` of what is still missing. Both show in
the app, under the title.

## Credits and licenses

- Code: [MIT](LICENSE).
- Game data and translations: [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/), derived
  from the System Reference Document 5.1 by Wizards of the Coast LLC, including its official
  Italian, French, German and Spanish translations. The full attribution is in the app (footer,
  *Credits and licenses*) and in `data/srd51/NOTICE.md`.
- The sheet layout is inspired by the character sheets of Emmet Byrne; no artwork or text of
  his is used.

This is an unofficial fan project, not affiliated with or endorsed by Wizards of the Coast.
