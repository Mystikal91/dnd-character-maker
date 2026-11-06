// Audit: for a class (and its subclasses), list each feature by level with the effects the app
// encodes, so what is text-only can be checked against the book.
// Usage: node scripts/audit-subclass.mjs <class-slug> [sub|class|all]   (default: sub)
import { readFileSync } from "node:fs";

const read = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
const classes = read("data/srd51/classes.json").entries;
const subs = read("data/srd51/subclasses.json").entries;
const feats = new Map(read("data/srd51/features.json").entries.map((f) => [f.id, f]));
const texts = read("locales/en/srd51/features.json");
const subTexts = read("locales/en/srd51/subclasses.json");
const [clsSlug, what = "sub"] = process.argv.slice(2);
const slug = (id) => id.split("/")[1];

const describe = (e) =>
  (e.effects ?? [])
    .map((x) => {
      const { type, ...rest } = x;
      return `${type}${Object.keys(rest).length ? JSON.stringify(rest) : ""}`;
    })
    .join("; ");

function show(id, level) {
  const f = feats.get(id);
  if (!f) return console.log(`  L${level} ${id}  (NOT IN features.json)`);
  const s = slug(id);
  const text = (texts[`${s}.desc`] ?? "").replace(/\s+/g, " ");
  const extra = f.data.activation ? ` [${f.data.activation}]` : "";
  console.log(`  L${level} ${texts[`${s}.name`] ?? id}${extra}`);
  console.log(`      effects: ${describe(f) || "(none: text only)"}`);
  console.log(`      text: ${text.slice(0, 320)}`);
}

for (const cls of classes) {
  if (clsSlug && slug(cls.id) !== clsSlug) continue;
  if (what === "class" || what === "all") {
    console.log(`\n##### CLASS ${cls.id}`);
    for (const lv of cls.data.levels) {
      for (const id of lv.features) show(id, lv.level);
      const cs = Object.entries(lv.classSpecific ?? {}).map(
        ([k, v]) => `${k}=${JSON.stringify(v)}`,
      );
      if (cs.length) console.log(`  L${lv.level} classSpecific: ${cs.join(" ")}`);
    }
  }
  if (what === "sub" || what === "all") {
    for (const sub of subs.filter((x) => x.parent === cls.id)) {
      console.log(`\n=== SUBCLASS ${subTexts[`${slug(sub.id)}.name`] ?? sub.id} (${sub.id})`);
      if (sub.effects?.length) console.log(`  [subclass effects] ${describe(sub)}`);
      if (sub.data.spells?.length) console.log(`  spells: ${JSON.stringify(sub.data.spells)}`);
      if (sub.data.expanded?.length)
        console.log(`  expanded: ${JSON.stringify(sub.data.expanded)}`);
      if (sub.data.spellcasting)
        console.log(`  spellcasting: ${JSON.stringify(sub.data.spellcasting)}`);
      for (const lv of sub.data.levels) for (const id of lv.features) show(id, lv.level);
    }
  }
}
