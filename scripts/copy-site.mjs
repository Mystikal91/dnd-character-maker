// Puts the welcome page and the legal pages (site/) next to the app (dist/app/) in dist/.
import { cpSync } from "node:fs";

cpSync("site", "dist", { recursive: true });
