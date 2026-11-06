# Print check

Prints the Print tab of the example character with a real Chrome (DevTools protocol) and a real
Firefox (Marionette), with and without background graphics, in a dark or light colour set, and
renders the pages to PNG. It shows what the browsers' own print dialogs would give.

```bash
npm run dev                                   # in another terminal
mkdir -p out
node scripts/print-check/chrome.mjs out Scura   # chrome-Scura-bg.pdf, chrome-Scura-nobg.pdf
node scripts/print-check/firefox.mjs out Scura  # firefox-Scura-bg.pdf, firefox-Scura-nobg.pdf
python scripts/print-check/render.py out        # out/<name>-<page>.png
```

`STRESS=6 node scripts/print-check/chrome.mjs out Scura` copies the last row of the spell list six
times to see how the front page copes with a long list. The browser paths are the usual ones on
Windows; change them at the top of the scripts.
