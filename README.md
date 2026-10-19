# DND Character Maker

A static, offline-first web app to create D&D 5e characters, print the sheet and spell list,
and use the character on screen during play. No server, no accounts: all data stays on your device.

> Status: early development.

## Development

```bash
npm install
npm run dev        # start the dev server
npm test           # unit tests (rules engine)
npm run lint       # Biome lint + format check
npm run build      # type-check and production build into dist/
```

Node 20+ is required (the PWA build step fails on older versions); Node 22 is used in CI.

## Project layout

| Path | Purpose |
|------|---------|
| `src/engine/` | Rules engine: pure TypeScript, no UI dependencies |
| `src/ui/` | Preact components and styles |
| `public/` | Static assets |
| `.github/workflows/` | CI and GitHub Pages deployment |

## Translating

The interface is available in English and Italian, and translations are managed with Weblate.
See [docs/TRANSLATING.md](docs/TRANSLATING.md).

## Content packs

Besides the SRD 5.1, people can add their own packs and read Aurora XML files they already
have. See [docs/CONTENT_PACKS.md](docs/CONTENT_PACKS.md).

## Versions and changelog

The version and its stage (`beta`) are in `src/app/version.ts`. What changed in each version is
listed in `src/content/news.ts` (`CHANGELOG`, newest first: write the lines in English and, if
possible, in the other languages) next to the `ROADMAP` of what is still missing. Both show in
the app, under the title.

## Licenses

- Code: [MIT](LICENSE).
- Game data and translations: [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/), derived from the
  System Reference Document by Wizards of the Coast LLC. Full attribution will be provided in the app.

This project is not affiliated with or endorsed by Wizards of the Coast.
