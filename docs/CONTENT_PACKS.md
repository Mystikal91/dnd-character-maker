# Content packs

The app ships with the SRD 5.1 only. People can add their own content as **packs**, which live
in the browser (IndexedDB) of the device that added them. Open them from the footer link
*Content packs*.

## Two kinds of pack

| Kind | Where it comes from | Can be exported |
| --- | --- | --- |
| Homebrew | written by the user, or a `.dndpack.json` file made by this app | yes |
| Personal | read from files the user already has | **no** |

A personal pack can be removed but never exported, and it is never part of a shared character
link: a link carries only the character, so whoever opens it needs their own copy of the content.

## Aurora XML

Files in the XML format used by the [Aurora character builder](https://aurorabuilder.com) can be
added with *Add Aurora XML files*. The reader only translates structure (`src/import/aurora/`).
It supports spells, weapons, armor, adventuring gear, languages, backgrounds (with their
personality tables), races, sub-races and racial traits, feats, classes (hit die, spell tables,
Pact Magic, ability score improvements, multiclassing), archetypes and their features. Everything
else (magic items, companions...) is reported as not supported yet. Rules the app cannot apply
automatically keep their text, and the report counts them. Entries the app already has (the SRD)
are left out and anything that refers to them is pointed at the app's own entry.

What the app deliberately does **not** do:

- ship any Aurora or publisher content;
- download content from any server, or keep a list of places to fetch it from;
- let a personal pack be exported or shared.

The files are read in the browser, processed there and stored on the device. Only add content
you have the right to use.

## Pack file format

A homebrew pack file is JSON with `format: "dnd-character-maker-pack"`, an `id`, a `name`, the
`lang` of its texts, a `pack` (manifest and entries, as in `src/data/schema.ts`) and `strings`
keyed by `<entry id>.<field>` (`name`, `desc`, ...). Pack ids may not be `srd51` or `srd52`.
