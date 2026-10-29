/// <reference types="vitest" />
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// The app lives under /app/ of heroquill.app; the welcome page and the legal pages are in site/.
const base = "/app/";

export default defineConfig({
  base,
  build: { outDir: "dist/app", emptyOutDir: true },
  plugins: [
    preact(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Heroquill",
        short_name: "Heroquill",
        description: "Create, print and play D&D 5e characters, online or offline.",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#1b1b1f",
        theme_color: "#7a1f1f",
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,json,woff2}"],
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
