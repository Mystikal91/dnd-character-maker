// Needs the dev server (npm run dev) and the browser installed; the `ws` package comes with the repo.
// Prints the Print tab of the app to PDF with a real Firefox (Marionette), as the browser's own print does.
// Usage: node firefox_pdf.mjs <outDir> [scheme: Scura|Chiara] [url]
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = process.argv[2];
const scheme = process.argv[3] ?? "Scura";
const url = process.argv[4] ?? "http://localhost:5173/app/";
const firefox = "C:/Program Files/Mozilla Firefox/firefox.exe";
const profile = mkdtempSync(join(tmpdir(), "hq-ff-"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(
  firefox,
  ["-marionette", "-headless", "-no-remote", "-profile", profile, "about:blank"],
  {
    stdio: "ignore",
  },
);

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      return await new Promise((resolve, reject) => {
        const s = net.connect(2828, "127.0.0.1", () => resolve(s));
        s.on("error", reject);
      });
    } catch {
      await sleep(500);
    }
  }
  throw new Error("Firefox did not start");
}

const socket = await connect();
let buffer = "";
const waiting = new Map();
let greeted;
const greeting = new Promise((r) => {
  greeted = r;
});
socket.on("data", (chunk) => {
  buffer += chunk.toString("utf8");
  for (;;) {
    const colon = buffer.indexOf(":");
    if (colon < 0) return;
    const len = Number(buffer.slice(0, colon));
    // length is in bytes; the traffic here is ASCII or base64, so characters are bytes
    if (buffer.length < colon + 1 + len) return;
    const body = buffer.slice(colon + 1, colon + 1 + len);
    buffer = buffer.slice(colon + 1 + len);
    const msg = JSON.parse(body);
    if (Array.isArray(msg)) {
      const [, id, error, result] = msg;
      waiting.get(id)?.({ error, result });
    } else {
      greeted(msg);
    }
  }
});
await greeting;
let id = 0;
const command = (name, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    waiting.set(n, ({ error, result }) =>
      error ? reject(new Error(JSON.stringify(error))) : resolve(result),
    );
    const body = JSON.stringify([0, n, name, params]);
    socket.write(`${Buffer.byteLength(body)}:${body}`);
  });

await command("WebDriver:NewSession", { capabilities: {} });
await command("WebDriver:Navigate", { url });
await sleep(4000);
const script = `
  const done = arguments[arguments.length - 1];
  (async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const btn = (re) => [...document.querySelectorAll('button')].find((b) => new RegExp(re, 'i').test(b.innerText));
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => /Scura/.test(o.text)));
    if (sel) { const o = [...sel.options].find((o) => o.text === ${JSON.stringify(scheme)}); sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    await wait(300);
    btn('^\\\\s*Crea')?.click(); await wait(600);
    btn('Prova un esempio')?.click(); await wait(2500);
    btn('^\\\\s*Stampa')?.click(); await wait(2500);
    return document.querySelectorAll('.p-page').length + ' pages';
  })().then(done);
`;
const state = await command("WebDriver:ExecuteAsyncScript", { script, args: [] });
console.log("app state:", JSON.stringify(state));

for (const background of [true, false]) {
  const res = await command("WebDriver:Print", {
    background,
    shrinkToFit: false,
    orientation: "portrait",
    page: { width: 21, height: 29.7 },
    margin: { top: 1.2, bottom: 1.2, left: 1.2, right: 1.2 },
  });
  const file = join(out, `firefox-${scheme}-${background ? "bg" : "nobg"}.pdf`);
  writeFileSync(file, Buffer.from(res.value, "base64"));
  console.log("wrote", file);
}
socket.end();
proc.kill();
