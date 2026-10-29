// Draws the PNG icons from the two SVG ones (public/icon.svg, public/icon-maskable.svg).
// Run with `npm run icons` after changing them, and commit the result.
import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const png = (svgFile, size, out) => {
  const svg = readFileSync(svgFile, "utf8");
  const data = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  for (const dir of out) writeFileSync(`${dir}`, data);
};

png("public/icon.svg", 192, ["public/icon-192.png"]);
png("public/icon.svg", 512, ["public/icon-512.png"]);
png("public/icon-maskable.svg", 512, ["public/icon-maskable-512.png"]);
// iOS rounds the corners itself, so it gets the full square.
png("public/icon-maskable.svg", 180, ["public/apple-touch-icon.png", "site/apple-touch-icon.png"]);
