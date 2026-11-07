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
- `{ "type": "when", "requires": "!LINE", "effects": [ ... ] }` holds its effects only while the
  requirement does. It is checked every time the sheet is worked out, against what the character
  has then. A requirement is written as Aurora writes it: names, `,` for "and", `||` for "or", `!`
  for "not", brackets to group (`!(A||B)`). A name is held when it is the id of an entry the
  character has (the species, a sub-species, a class, a feat, a trait that came with something)
  or a flag set by a `flag` effect. A condition on the sheet, `[str:13]`, is understood as a
  word that nothing holds yet.
- `{ "type": "flag", "id": "LINE" }` sets a name that requirements can ask for, for a rule that
  says "this is held" without being an entry. It counts only where the effect itself applies,
  so a flag inside a `when` is set only while that holds. Together they let a species keep the
  increases that a sub-species takes away: `when !LINE` on the species, `flag LINE` on the
  sub-species.

An entry of kind `option` is a rule a character can switch on (`options` of the character, a list
of entry ids; the build step lists them). A switched-on option is held by its id, and its own
effects apply. The Aurora importer makes the options that other rules ask for (Tasha's customised
origin) and gives each a `flag` with its Aurora id, so that rules of another pack, which can only
name it by that id, see it too.
- Item data can hold `rarity` (a magic item), `enhancement` (+1 to +3 to attack and damage, also on
  a weapon that is carried: a homebrew +1 sword), `magical` (a weapon that counts as magic without
  a rarity), `copyOf` (the id of the item a person's copy was made from: a customized club still
  takes Shillelagh) and `enchants: true` (the item is put on a weapon of the inventory instead of
  being carried: the Aurora importer sets it for the magic weapons it reads). Armor and weapons
  can list `properties` (ids of entries of kind `property`: a title and a text, no effect). The
  spells Shillelagh and Magic Weapon are not item data: they are effects the person switches on
  in Play, on one weapon, until a rest.
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

A `grantSpell` effect can carry a `minLevel` (the spell comes with that level of the class),
`free: true` (cast once between rests without a slot, with `rest: "short"` for a short rest, the
long rest otherwise) or `atWill: true` (cast as often as wanted without a slot: the sheet lists it
with the cantrips and it has no Cast button; the invocations of the warlock use it).

A `choice` that grants a `spell` and lists no `from` is open: `spellLevel` (one level), `spellUpTo`
(that level and below, cantrips included), `spellClass` and `ritual` say which spells of the
whole game it offers, and `free`, `rest` and `atWill` say how a pick is cast (the three cantrips
of the Pact of the Tome, Mystic Arcanum, Spell Mastery, Magical Secrets). A list of more than
forty spells is a menu in the choices.

`{ "type": "spellDamage", "plus": "cha", "spell": "srd51:spell/eldritch-blast" }` adds the
modifier of an ability to the damage a spell rolls in Play; `spell`, `school` or `damageType` say
which spells, and `once` adds it to one roll of the spell instead of every roll.

`{ "type": "abilityBonus", "ability": "str", "value": 4, "max": 24 }` raises a score; `max` is the most the
score may reach with it (24 for the barbarian's Primal Champion), 20 when absent, and the sheet warns above it.
A `modifier` may have `min`: the bonus is at least that once `plus` is added (an aura of protection adds the
Charisma modifier to saves, +1 at the least).

`{ "type": "spellHealing", "plusSlotLevel": 2 }` changes the healing that spells roll in Play (only
spells with a healing roll in the data, cast with a slot of 1st level or higher): `plusSlotLevel` adds
that and the level of the slot to every roll (Disciple of Life), `maxDice` gives the highest number on
every die (Supreme Healing) and `selfPlusSlotLevel` adds a button that heals the caster that and the
level of the slot when the healing is for someone else (Blessed Healer).

`{ "type": "extraDamage", "damageType": "radiant", "steps": [{ "minLevel": 8, "dice": "1d8" }], "note":
"oncePerTurn" }` is damage a feature adds to attacks (Divine Strike): the dice of the highest step the
level of the class reaches, shown with the extra damage of the classes and rolled by a card of its own in
Play. `note` picks the sentence that says when it applies (so far only `oncePerTurn`).

`{ "type": "unarmedStrike", "dice": "1d6", "damageType": "piercing" }` is a natural weapon (claws, a
bite, horns): the unarmed strike rolls that die and that kind of damage in place of its 1 and
bludgeoning, and is shown even when a weapon is in hand. Without one, the unarmed strike is shown to a
monk (martial arts die, Strength or Dexterity) and to a character who holds no weapon.

What an option of a choice asks for is read from `data.prerequisites` of the option (entries with
`type` `level`, `feature` or `spell`, or an `ability` with a `minimum`) or, in an imported pack,
from `data.requires`, written as the requirements of `when`. The choices show it ("Requires: level
9, Pact of the Blade") and do not let the person pick an option whose requirement is not met; a
word the app does not know never shuts an option. Feats are checked the same way.
A subclass entry can list spells it always prepares (`spells`), spells it adds to the class's
list (`expanded`, a warlock patron) and, for a class that does not cast, its own
`spellcasting`: the ability, the class whose list it picks from and the cantrips, spells known
and slots per level, like the Eldritch Knight. The homebrew editor offers the third caster's
tables for a subclass.

Some data fields are not effects:

- `startingChoices` of a class or background: a list of choices, each `{ "options": [{ "items": [...], "requires": "warhammers" }] }`
  (take one option; `requires` is a proficiency the rules ask for, shown but not enforced). An item is
  `{ "item": "srd51:item/mace", "quantity": 1 }` or, to pick from a category of the SRD, `{ "category": "martial-weapons", "count": 2 }`
  (`simple-weapons`, `martial-weapons`, `simple-melee-weapons`, `martial-melee-weapons`, `arcane-foci`, `holy-symbols`,
  `druidic-foci`, `musical-instruments`). `startingEquipment` is what is given without a choice. The Equipment step asks them.
- `startingWealth` of a class: `{ "dice": "5d4", "multiplier": 10 }`, the gold it may start with instead. The SRD does not
  print it, so the SRD classes have none.
- `replaces` of a feature: ids of the features it makes obsolete (the earlier steps of an improving feature). They are hidden
  from the sheet while the character has the new one, unless the person turns them back on.
- `hiddenByDefault: true` on a feature, trait or feat keeps it off the sheet unless the person turns it on (its effects apply).
- `gear.bundleSize` on an item (ammunition): how many pieces one unit holds; starting equipment counts pieces and the
  inventory bundles.

The features of the SRD get theirs from `scripts/srd51/effects.ts`; a feature that offers options
(a fighting style) has a `choice` over its child features. Class features and subclass features
count once the character has reached their level.

## Homebrew editor

*New homebrew pack* on the packs page opens an editor with a form for each kind of entry:
spells, weapons, armor, gear, properties (a title and a text, for weapons and armor), languages,
feats, species (with their traits), backgrounds, classes and subclasses (with personality tables).
Weapons and armor can also be made from the inventory: *Customize* on a weapon or armor opens a
window with the same fields, and saves the result as an item of the first homebrew pack (one is
made if there is none) that takes the place of the original in the inventory. Entries are saved as soon as the form is saved, appear in the build
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
(picked in the Story step of a character) and companions (familiars, beasts, defenders), which
become monsters with their traits, actions and reactions: the numbers of the stat block are
read where they are plain (`13 (natural armor)`, `40 ft., fly 60 ft.`), and what depends on the
level or the proficiency bonus (`14 + PB`) is kept as it was written. They are in the
*Monster* list of the rules page. Definitions the reader uses by itself (sources,
proficiencies, visions, flags) are not reported. Race variants and dragonmarks become sub-species
of their race. Background variants and statblocks are reported as not supported yet. Rules the
app cannot apply automatically keep their text, and the report counts them.

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

## Which pack wins

Packs apply in this order, and what comes later wins when two give the same text: the built-in
rules, then content imported from other tools (the pack added later wins), then your homebrew
packs, then your **quick edits**. Entries of different packs have different id prefixes, so they
never replace each other; the order matters for texts.

Quick edits are the texts a person rewrote with the pencil next to a name or a text. They are kept
in one pack per language (`edits<language>`, for example `editsit`) that holds only texts, keyed
by the full entry id (`srd51:spell/fireball.name`), and they apply only while that language is in
use. They never change an entry's data or effects.

## Importing a pack again

A pack imported from Aurora keeps where it came from (`source`: the address, or the names of the files), the version of the importer that made it (`importVersion`, compared with `AURORA_IMPORT_VERSION` in `src/import/aurora/index.ts`) and whether the 2024 versions were kept. When the importer is improved, raise the constant: older packs are marked "Needs updating" on the packs page and can be made again with one click. The pack keeps its id, so the characters that use its entries keep working. Raise the constant whenever a change alters what the importer produces.

## Checking the importer against all of Aurora

`npm run test:corpus` runs the importer over the whole of Aurora's content (a clone of
`AuroraLegacy/elements` at the commit pinned in `.github/workflows/deploy.yml`, found through the
`AURORA_CORPUS` variable) in both orders of reading. Besides the checks on species and references,
it compares every element with `src/import/aurora/corpus.baseline.json`: for each Aurora id, how
many effects the element ended with and how many of its rules the app could not apply. The test
fails when something got worse (an element gone, fewer effects, more rules left out); better
results and new elements pass. After a change that was meant, run the corpus with `AURORA_ACCEPT=1`
(the first of the two readings writes the file) and commit the new baseline with the change.
