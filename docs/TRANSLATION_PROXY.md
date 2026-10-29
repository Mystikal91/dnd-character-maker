# Translation relay (Cloudflare Worker)

Automatic translation with [DeepL](https://www.deepl.com/pro-api) needs a small relay: the
DeepL API sends no CORS headers, so a web page cannot call it directly. The relay in
`workers/translate-proxy/` takes the app's request, adds the CORS headers and passes it on.

What it does and does not do:

- it relays only `POST /v2/translate` and `GET /v2/usage`, so it cannot be used as an open proxy;
- it answers only to the sites listed in `ALLOWED_ORIGINS` (default: the published app and the
  local dev server);
- the DeepL key comes from the person using the app, in the `Authorization` header. The relay
  uses it for that one request and keeps nothing; nothing is logged;
- a key ending in `:fx` is a free-plan key and goes to `api-free.deepl.com`, any other key to
  `api.deepl.com`.

The app's *Automatic translation* page points at `https://dnd-translate.mystikal91.workers.dev`
by default; the address can be changed there, so anyone can run a relay of their own.

## Publishing it (no command line)

1. Make a free account at [cloudflare.com](https://dash.cloudflare.com/sign-up). The free plan
   allows 100,000 requests a day, far more than a translation needs.
2. In the dashboard open **Workers & Pages**, then **Create**, **Create Worker**. Name it
   `dnd-translate` and press **Deploy**.
3. Press **Edit code**, delete the sample code, paste the whole of
   [`workers/translate-proxy/worker.js`](../workers/translate-proxy/worker.js) and press
   **Deploy**.
4. If the app is not served from `https://heroquill.app` (a fork, another address), open
   **Settings**, **Variables and Secrets**, add a text variable `ALLOWED_ORIGINS` with the
   address of your copy, e.g. `https://example.com`, and deploy again. The address has no
   path and no trailing slash. Several addresses are separated by commas.
5. The relay lives at `https://dnd-translate.<your-account>.workers.dev`. That address is what
   goes into the app, together with a DeepL key.

## Publishing it with Wrangler

```bash
cd workers/translate-proxy
npx wrangler login
npx wrangler deploy
```

Edit `wrangler.toml` first to set `ALLOWED_ORIGINS`.

## Checking that it works

Replace the address and the key (a free key ends in `:fx`):

```bash
curl -s https://dnd-translate.<your-account>.workers.dev/v2/usage \
  -H "Origin: https://mystikal91.github.io" \
  -H "Authorization: DeepL-Auth-Key <your key>"
```

The answer is a JSON object with `character_count` and `character_limit`.


## Free translation for people without a DeepL key

The relay also answers `POST /v1/translate`, which translates with Cloudflare Workers AI (the
`m2m100` model) and asks for no key. It draws on the free allowance of the account that runs the
relay (10,000 "neurons" a day, shared by everyone who uses it; check Cloudflare's pricing page for
the present figure). When the allowance of the day is used up the relay answers 456, the same code
DeepL uses, and the app goes on to its last resort, MyMemory, called straight from the browser
(about 5,000 characters a day for each person, no account).

To turn it on, add the AI binding to the relay:

1. In the dashboard open **Workers & Pages**, then the `dnd-translate` worker.
2. Paste the new [`worker.js`](../workers/translate-proxy/worker.js) in **Edit code** and deploy.
3. Open **Settings**, **Bindings**, **Add**, choose **Workers AI** and name the binding `AI`
   (exactly that). Deploy again.

With Wrangler the binding is in `wrangler.toml` already (`[ai]`).

A light brake limits how often one address may ask (30 requests a minute in each instance of the
worker); it is not a guarantee, so keep an eye on the usage page of the account.

### How the app chooses

For each batch of texts the app tries, in order: DeepL with the person's key (if there is one), the
free translation of the relay, MyMemory. It remembers which engine made each saved translation. When
a better engine becomes available (a key is added, the relay is set up, the allowance renews) a
text that a weaker engine translated is translated again the next time it is read, and replaced if
the new translation came from a better engine. The option "Improve translations over time" turns
this off. Translations that arrive in a transfer file carry no engine and count as DeepL's.
