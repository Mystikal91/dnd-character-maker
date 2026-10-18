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

## Licenses

- Code: [MIT](LICENSE).
- Game data and translations: [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/), derived from the
  System Reference Document by Wizards of the Coast LLC. Full attribution will be provided in the app.

This project is not affiliated with or endorsed by Wizards of the Coast.
