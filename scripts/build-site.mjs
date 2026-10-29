// Builds the site around the app into dist/: the welcome page and the guide, one plain HTML page
// per language of each (/, /it/, /fr/, /de/, /es/ and /guide/, /it/guida/, ...) so search engines
// read each in its own language, with the links between them (hreflang), the data for search
// results (JSON-LD), a sitemap and robots.txt; plus the legal pages, the colour sets the pages
// share with the app, and the fonts they need (served from here, so the pages ask no one else for
// anything).
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { GUIDE } from "../site/guide.mjs";
import { TEXTS } from "../site/texts.mjs";

const ORIGIN = "https://heroquill.app";
const LANGUAGES = ["en", "it", "fr", "de", "es"];
const LOCALES = { en: "en_US", it: "it_IT", fr: "fr_FR", de: "de_DE", es: "es_ES" };
const FAQ = [1, 2, 3, 4, 5];

const homePath = (lang) => (lang === "en" ? "/" : `/${lang}/`);
const guidePath = (lang) => `${homePath(lang)}${GUIDE[lang].slug}/`;
const escapeHtml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (text) => escapeHtml(text).replace(/"/g, "&quot;");
const today = new Date().toISOString().slice(0, 10);

const alternatesOf = (pathOf) =>
  [
    ...LANGUAGES.map(
      (l) => `    <link rel="alternate" hreflang="${l}" href="${ORIGIN}${pathOf(l)}" />`,
    ),
    `    <link rel="alternate" hreflang="x-default" href="${ORIGIN}${pathOf("en")}" />`,
  ].join("\n");

// Every option of the language list leads to the same kind of page in its language.
const withLanguageLinks = (html, lang, pathOf) => {
  let out = html;
  for (const l of LANGUAGES)
    out = out.replace(`<option value="${l}"`, `<option value="${l}" data-href="${pathOf(l)}"`);
  return out.replace(
    `<option value="${lang}" data-href`,
    `<option value="${lang}" selected data-href`,
  );
};

// Every element with data-i18n holds only a text: it is replaced by the text of the language.
function translate(html, lang) {
  const t = TEXTS[lang];
  const missing = new Set();
  const out = html.replace(
    /(<([a-zA-Z][\w-]*)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g,
    (whole, open, _tag, key, _old, close) => {
      const text = t[key];
      if (text === undefined) {
        missing.add(key);
        return whole;
      }
      return `${open}${escapeHtml(text)}${close}`;
    },
  );
  if (missing.size > 0) throw new Error(`${lang}: no text for ${[...missing].join(", ")}`);
  return out;
}

// ---- the welcome page ----
const template = readFileSync("site/index.template.html", "utf8");

function homeJsonLd(lang, t) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${ORIGIN}/#website`,
        url: `${ORIGIN}/`,
        name: "Heroquill",
        inLanguage: LANGUAGES,
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${ORIGIN}/#app`,
        name: "Heroquill",
        url: `${ORIGIN}${homePath(lang)}`,
        description: t["meta.desc"],
        applicationCategory: "GameApplication",
        operatingSystem: "Any (web browser)",
        browserRequirements: "Requires a modern web browser",
        inLanguage: lang,
        isAccessibleForFree: true,
        image: `${ORIGIN}/og-image.png`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        featureList: [
          t["val.srd"],
          t["val.multi"],
          t["val.homebrew"],
          t["val.aurora"],
          t["val.pdf"],
          t["val.offline"],
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((n) => ({
          "@type": "Question",
          name: t[`faq.q${n}`],
          acceptedAnswer: { "@type": "Answer", text: t[`faq.a${n}`] },
        })),
      },
    ],
  }).replace(/</g, "\\u003c");
}

function homePage(lang) {
  const t = TEXTS[lang];
  const html = template
    .replaceAll("{{lang}}", lang)
    .replaceAll("{{title}}", escapeAttr(t["meta.title"]))
    .replaceAll("{{description}}", escapeAttr(t["meta.desc"]))
    .replaceAll("{{url}}", `${ORIGIN}${homePath(lang)}`)
    .replaceAll("{{ogLocale}}", LOCALES[lang])
    .replaceAll("{{guideUrl}}", guidePath(lang))
    .replace("{{alternates}}", alternatesOf(homePath))
    .replace("{{jsonld}}", homeJsonLd(lang, t));
  return withLanguageLinks(translate(html, lang), lang, homePath);
}

// ---- the guide: the head, bar and foot of the welcome page around an article ----
function guideBlocks(sections) {
  return sections
    .map(([heading, blocks]) => {
      const body = blocks
        .map((block) =>
          Array.isArray(block)
            ? `<ul>\n${block.map((item) => `            <li>${escapeHtml(item)}</li>`).join("\n")}\n          </ul>`
            : `<p>${escapeHtml(block)}</p>`,
        )
        .join("\n          ");
      return `        <section>\n          <h2>${escapeHtml(heading)}</h2>\n          ${body}\n        </section>`;
    })
    .join("\n");
}

function guidePage(lang) {
  const g = GUIDE[lang];
  const t = TEXTS[lang];
  const home = homePath(lang);
  const homeHtml = homePage(lang);
  const bar = /<header class="nav on-dark">[\s\S]*?<\/header>/.exec(homeHtml)?.[0];
  const foot = /<footer class="foot on-dark">[\s\S]*?<\/footer>/.exec(homeHtml)?.[0];
  if (!bar || !foot) throw new Error("the bar or the foot of the welcome page was not found");
  // The links of the bar that point inside the welcome page keep pointing there from here, and
  // each language of the list leads to the guide in that language.
  const barHere = LANGUAGES.reduce(
    (html, l) =>
      html.replace(
        new RegExp(`(<option value="${l}"[^>]*?)data-href="[^"]*"`),
        `$1data-href="${guidePath(l)}"`,
      ),
    bar.replace(/href="#/g, `href="${home}#`),
  );
  const url = `${ORIGIN}${guidePath(lang)}`;
  const jsonld = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: g.h1,
        description: g.desc,
        inLanguage: lang,
        mainEntityOfPage: url,
        datePublished: today,
        dateModified: today,
        image: `${ORIGIN}/og-image.png`,
        author: { "@type": "Organization", name: "Heroquill", url: `${ORIGIN}/` },
        publisher: { "@type": "Organization", name: "Heroquill", url: `${ORIGIN}/` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Heroquill", item: `${ORIGIN}${home}` },
          { "@type": "ListItem", position: 2, name: t["nav.guide"], item: url },
        ],
      },
    ],
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="${lang}" data-palette="notte">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark light" />
    <meta name="theme-color" content="#121a2c" />
    <title>${escapeHtml(g.title)}</title>
    <meta name="description" content="${escapeAttr(g.desc)}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${url}" />
${alternatesOf(guidePath)}
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Heroquill" />
    <meta property="og:title" content="${escapeAttr(g.title)}" />
    <meta property="og:description" content="${escapeAttr(g.desc)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:locale" content="${LOCALES[lang]}" />
    <meta property="og:image" content="${ORIGIN}/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(g.title)}" />
    <meta name="twitter:description" content="${escapeAttr(g.desc)}" />
    <meta name="twitter:image" content="${ORIGIN}/og-image.png" />
    <script type="application/ld+json">${jsonld}</script>
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="preload" href="/fonts/cinzel-700.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" href="/palettes.css" />
    <link rel="stylesheet" href="/site.css" />
    <script>
      document.documentElement.classList.add("js");
      try {
        var saved = JSON.parse(localStorage.getItem("theme") || "null") || {};
        var palettes = ["notte", "classico", "bordeaux", "foresta", "arcano", "ghiaccio", "rame", "ossidiana"];
        var before = !("palette" in saved) && ("style" in saved || "scheme" in saved);
        document.documentElement.dataset.palette =
          palettes.indexOf(saved.palette) >= 0 ? saved.palette : before ? "classico" : "notte";
      } catch (e) {}
    </script>
  </head>
  <body>
    ${barHere}

    <main>
      <section class="page-hero on-dark">
        <div class="wrap narrow">
          <p class="crumb"><a href="${home}">Heroquill</a> › ${escapeHtml(t["nav.guide"])}</p>
          <h1>${escapeHtml(g.h1)}</h1>
          <p class="lead">${escapeHtml(g.intro)}</p>
        </div>
      </section>

      <article class="band on-light">
        <div class="wrap narrow prose">
${guideBlocks(g.sections)}
        </div>
      </article>

      <section class="cta on-dark">
        <div class="wrap">
          <p class="lead">${escapeHtml(g.cta)}</p>
          <div class="actions">
            <a class="button" href="/app/#example">${escapeHtml(t["hero.try"])}</a>
            <a class="button ghost" href="/app/">${escapeHtml(t["hero.cta"])}</a>
          </div>
        </div>
      </section>
    </main>

    ${foot}
    <script src="/site.js"></script>
  </body>
</html>
`;
}

// ---- the pages ----
mkdirSync("dist", { recursive: true });
for (const lang of LANGUAGES) {
  const directory = lang === "en" ? "dist" : `dist/${lang}`;
  mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}/index.html`, homePage(lang));
  const guideDirectory = `dist${guidePath(lang).slice(0, -1)}`;
  mkdirSync(guideDirectory, { recursive: true });
  writeFileSync(`${guideDirectory}/index.html`, guidePage(lang));
}

// ---- what the pages share, and the files that are copied as they are ----
for (const file of [
  "site.css",
  "site.js",
  "privacy.html",
  "terms.html",
  "icon.svg",
  "apple-touch-icon.png",
  "og-image.png",
  "_headers",
]) {
  cpSync(`site/${file}`, `dist/${file}`);
}
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

// ---- for search engines ----
const entryOf = (pathOf, lang) => {
  const links = [
    ...LANGUAGES.map(
      (l) => `      <xhtml:link rel="alternate" hreflang="${l}" href="${ORIGIN}${pathOf(l)}"/>`,
    ),
    `      <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}${pathOf("en")}"/>`,
  ].join("\n");
  return `  <url>\n    <loc>${ORIGIN}${pathOf(lang)}</loc>\n    <lastmod>${today}</lastmod>\n${links}\n  </url>`;
};
const entries = [
  ...LANGUAGES.map((lang) => entryOf(homePath, lang)),
  ...LANGUAGES.map((lang) => entryOf(guidePath, lang)),
].join("\n");
writeFileSync(
  "dist/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries}\n</urlset>\n`,
);
writeFileSync("dist/robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
