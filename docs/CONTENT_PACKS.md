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

## What an entry can do

Entries carry declarative `effects`; the engine applies them and the sheet shows where each
number comes from. The kinds are `abilityBonus`, `proficiency`, `trait`, `choice`, `grantSpell`,
`resource`, and two for numbers of the sheet:

- `{ "type": "modifier", "target": "ac", "value": 1, "when": "wearingArmor" }` adds a flat bonus.
  Targets: `ac`, `speed`, `initiative`, `attack`, `damage`, `hpPerLevel`, `save` (every saving
  throw). Conditions: `wearingArmor`, `wearingShield`, `unarmored`, `noHeavyArmor`, `ranged`, `melee`, `dueling` (a one-handed melee weapon with no other
  weapon).
- `{ "type": "abilityFloor", "ability": "str", "value": 19 }` raises an ability score to at
  least that value (Gauntlets of Ogre Power) and never lowers it.
- `{ "type": "weaponAbility", "ability": "cha", "when": "oneHanded", "proficient": true }` lets
  weapons use that ability for attack and damage instead of Strength or Dexterity (the best one
  that applies wins). `when` narrows the weapons: `oneHanded` (no two-handed property) or
  `magic` (an item with a `rarity`); `proficient` asks for a weapon the character is proficient with.
- Item data can hold `rarity` (a magic item), `enhancement` (+1 to +3 to attack and damage) and
  `enchants: true` (the item is put on a weapon of the inventory instead of being carried: the
  Aurora importer sets it for the magic weapons it reads). A weapon in the inventory can also
  be marked `magical` and given a `bonus` by the person using the sheet.
- `{ "type": "defense", "kind": "resistance", "damage": "fire" }` is a resistance, an
  immunity or a vulnerability to a type of damage; the sheet lists them.
- `{ "type": "unarmoredDefense", "base": 10, "add": ["con"], "shield": true }` is armor class
  without armor: `base` + Dexterity + the listed abilities.

Items carry effects too: whatever a character has **equipped** adds the effects of the item (a ring
that gives +1 armor class and a resistance). A character that equips more than three items
with `"attunement": true` in their `data` gets a warning.

A `subspecies` entry with `"replacesSpecies": true` in its `data` stands in for its species: the
species' own effects are not applied and the variant lists everything it gives (a half-elf of
another descent, a dragonborn of Wildemount, a race with a dragonmark). The Aurora reader builds
these from Aurora's race variants, taking from the race what the variant replaces.

A `choice` can grant a `feat`: with an empty `from` it offers every feat there is, and the pick
(like a feat a species gives outright, as a `trait`) is listed with the feats of the sheet.

A `grantSpell` effect can carry a `minLevel` (the spell comes with that level of the class).
A subclass entry can list spells it always prepares (`spells`), spells it adds to the class's
list (`expanded`, a warlock patron) and, for a class that does not cast, its own
`spellcasting`: the ability, the class whose list it picks from and the cantrips, spells known
and slots per level, like the Eldritch Knight. The homebrew editor offers the third caster's
tables for a subclass.

The features of the SRD get theirs from `scripts/srd51/effects.ts`; a feature that offers options
(a fighting style) has a `choice` over its child features. Class features and subclass features
count once the character has reached their level.

## Homebrew editor

*New homebrew pack* on the packs page opens an editor with a form for each kind of entry:
spells, weapons, armor, gear, languages, feats, species (with their traits), backgrounds, classes and subclasses
(with personality tables). Entries are saved as soon as the form is saved, appear in the build
steps like the built-in ones, and can be edited or deleted later. A pack can be exported as a
file and added on another device. Classes use the standard spell slot tables (full caster, half caster or Pact Magic); every class and subclass feature is a name and a text at a level.

## Aurora XML

Files in the XML format used by the [Aurora character builder](https://aurorabuilder.com) can be
added with *Add Aurora XML files*. The reader only translates structure (`src/import/aurora/`).
It supports spells, weapons, armor, adventuring gear, languages, backgrounds (with their
personality tables), races, sub-races and racial traits, feats, classes (hit die, spell tables,
Pact Magic, ability score improvements, multiclassing), archetypes and their features, magic
items (as items: rarity and attunement are kept; bonuses to armor class, saving throws,
initiative and speed, ability scores, resistances, languages and proficiencies are applied while
the item is equipped, and the rest stays in the text) and deities
(picked in the Story step of a character). Definitions the reader uses by itself (sources,
proficiencies, visions, flags) are not reported. Race variants and dragonmarks become sub-species of their race. Companions, background variants
and statblocks are reported as not supported yet. Rules the app cannot apply
automatically keep their text, and the report counts them.

The same thing often comes from several books. Entries with one name that say exactly the same
(text, effects and data, ignoring spacing and curly quotes) are merged into one, and whatever
referred to the others refers to it. This app follows the 2014 rules, so when something has both a
2014 and a 2024 version the 2014 one is used and the 2024 one is left out (a checkbox on the packs
page keeps both); things that exist only in 2024 stay. Items Aurora keeps for its own books (feat
unlockers, starting equipment packs) are not imported.

A whole collection can be imported from its index file: the reader follows up to 1500 files, and
the Aurora Legacy collection (`AuroraLegacy.index`, about 750 files and 8000 entries) fits. Entries the app already has (the SRD)
are left out and anything that refers to them is pointed at the app's own entry.

What the app deliberately does **not** do:

- ship any Aurora or publisher content;
- download anything on its own, or keep a list of places to fetch from: it fetches only from an
  address the user types, or one listed in an index file the user chose, and only over https;
- let a personal pack be exported or shared.

Index files (`.index`) are followed to every content file they list, so one address can bring a
whole book. What is added, and the right to use it, is the user's responsibility.

The files are read in the browser, processed there and stored on the device. Only add content
you have the right to use.

## Pack file format

A homebrew pack file is JSON with `format: "dnd-character-maker-pack"`, an `id`, a `name`, the
`lang` of its texts, a `pack` (manifest and entries, as in `src/data/schema.ts`) and `strings`
keyed by `<entry id>.<field>` (`name`, `desc`, ...). Pack ids may not be `srd51` or `srd52`.
