// Needs the dev server (npm run dev) and the browser installed; the `ws` package comes with the repo.
// Prints the Print tab of the app to PDF with a real Chrome, as the browser's own print does, once with
// background graphics and once without. Usage: node print_pdf.mjs <outDir> [scheme: Scura|Chiara] [url]
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const WebSocket = require("ws");

const out = process.argv[2];
const scheme = process.argv[3] ?? "Scura";
const url = process.argv[4] ?? "http://localhost:5173/app/";
const chrome = "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe";
const port = 9333;
const profile = mkdtempSync(join(tmpdir(), "hq-chrome-"));

const proc = spawn(
  chrome,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--window-size=1100,1400",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function targets() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error("Chrome did not start");
}

const ws = new WebSocket(await targets());
await new Promise((r) => ws.on("open", r));
let id = 0;
const waiting = new Map();
ws.on("message", (m) => {
  const msg = JSON.parse(m);
  if (msg.id && waiting.has(msg.id)) waiting.get(msg.id)(msg);
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    waiting.set(n, (msg) =>
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result),
    );
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const run = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  return r.result?.value;
};

await send("Page.enable");
await send("Page.navigate", { url });
await sleep(3500);
const log = await run(`(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const btn = (re) => [...document.querySelectorAll('button')].find((b) => new RegExp(re, 'i').test(b.innerText));
  // the colour scheme (the third select: Automatica / Chiara / Scura)
  const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => /Scura/.test(o.text)));
  if (sel) { const o = [...sel.options].find((o) => o.text === ${JSON.stringify(scheme)}); sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  await wait(300);
  btn('^\\\\s*Crea')?.click(); await wait(600);
  btn('Prova un esempio')?.click(); await wait(2500);
  btn('^\\\\s*Stampa')?.click(); await wait(2500);
  return document.querySelectorAll('.p-page').length + ' pages; paper=' + !!document.querySelector('.paper');
})()`);
console.log("app state:", log);
if (process.env.STRESS) {
  const n = await run(`(() => {
    const panel = [...document.querySelectorAll('.p-front .p-panel')].find((p) => /LIST|ELENCO|List/i.test(p.querySelector('h3')?.innerText ?? ''));
    const row = panel.querySelector('.p-quick-row:last-of-type');
    for (let i = 0; i < ${process.env.STRESS}; i++) { const c = row.cloneNode(true); panel.appendChild(c); }
    return panel.querySelectorAll('.p-quick-row').length;
  })()`);
  console.log("stress rows:", n);
}

for (const background of [true, false]) {
  const pdf = await send("Page.printToPDF", {
    printBackground: background,
    paperWidth: 8.27,
    paperHeight: 11.69,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    preferCSSPageSize: true,
  });
  const file = join(
    out,
    `chrome-${process.env.TAG ?? ""}${scheme}-${background ? "bg" : "nobg"}.pdf`,
  );
  writeFileSync(file, Buffer.from(pdf.data, "base64"));
  console.log("wrote", file);
}
ws.close();
proc.kill();
