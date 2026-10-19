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
4. If the app is not served from `https://mystikal91.github.io` (a fork, another address), open
   **Settings**, **Variables and Secrets**, add a text variable `ALLOWED_ORIGINS` with the
   address of your copy, e.g. `https://example.github.io`, and deploy again. The address has no
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
