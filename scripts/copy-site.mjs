// Puts the welcome page and the legal pages (site/) next to the app (dist/app/) in dist/, with the
// colour sets the page shares with the app and the fonts it needs (served from here, not from a
// font service, so the page asks no one else for anything).
import { cpSync, mkdirSync } from "node:fs";

cpSync("site", "dist", { recursive: true });
cpSync("src/ui/theme/palettes.css", "dist/palettes.css");

mkdirSync("dist/fonts", { recursive: true });
const fonts = [
  ["node_modules/@fontsource/cinzel/files/cinzel-latin-600-normal.woff2", "cinzel-600.woff2"],
  ["node_modules/@fontsource/cinzel/files/cinzel-latin-700-normal.woff2", "cinzel-700.woff2"],
  [
    "node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2",
    "eb-garamond-400.woff2",
  ],
  [
    "node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-600-normal.woff2",
    "eb-garamond-600.woff2",
  ],
];
for (const [from, name] of fonts) cpSync(from, `dist/fonts/${name}`);
