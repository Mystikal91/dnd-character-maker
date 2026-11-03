"""Pairs the entries of the SRD with the elements of Aurora's Player's Handbook (2014).

    python scripts/aurora-pairs/pair.py path/to/aurora/elements/core

Writes `src/import/aurora/srdPairs.json`: for each Aurora id, the entries of the app that are the
same thing ({"ID_WOTC_PHB_CLASS_FEATURE_MONK_KI_FLURRY_OF_BLOWS": ["srd51:feature/flurry-of-blows"]}).
The importer keeps the entry of the app and never makes a second one, and (later) adds to it what
the element knows that the SRD data does not.

An element is paired with an entry only when it is certain: same class (or species), same name once
the prefixes of a group are set aside (`Fighting Style: Archery` is `Archery`) and the only one
with that name in that class. What the names do not settle is written by hand in `MANUAL`, since the
SRD hardly changes. Run it again after `npm run data:srd51` or when the pinned Aurora commit moves;
it prints what it could not pair, to read before trusting the result.
"""

import glob
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
AURORA = Path(sys.argv[1]) / "players-handbook"
OUT = REPO / "src/import/aurora/srdPairs.json"

# What the names cannot settle. Aurora id -> entries of the app (checked against the books).
MANUAL: dict[str, list[str]] = {
    # Names the books spell otherwise.
    "ID_WOTC_PHB_CLASS_FEATURE_BARBARIAN_PERSISTANT_RAGE": ["srd51:feature/persistent-rage"],
    "ID_WOTC_PHB_CLASS_FEATURE_WIZARD_SIGNATURE_SPELLS": ["srd51:feature/signature-spell"],
    "ID_RACIAL_TRAIT_CANTRIP": ["srd51:trait/high-elf-cantrip"],
}

# The subclass of the SRD for each class, and the file of Aurora that holds its features.
SUBCLASS_FILE = {
    "barbarian": "barbarian-berserker", "bard": "bard-lore", "cleric": "cleric-life",
    "druid": "druid-land", "fighter": "fighter-champion", "monk": "monk-open-hand",
    "paladin": "paladin-devotion", "ranger": "ranger-hunter", "rogue": "rogue-thief",
    "sorcerer": "sorcerer-draconic", "warlock": "warlock-fiend", "wizard": "wizard-evocation",
}

# The groups the SRD writes as "Group: Option" and Aurora as "Option".
PREFIXES = (
    "fighting style",
    "metamagic",
    "eldritch invocation",
    "hunters prey",
    "defensive tactics",
    "superior hunters defense",
    "multiattack",
    "channel divinity",
    "pact boon",
    "circle of the land",
)

# Names the SRD uses for something that is not a feature of the book (a place holder, a list).
PLACEHOLDER = re.compile(r"(feature|domain spells|oath spells|circle spells|expanded spell list)$")

# Features the SRD repeats at each level and that Aurora gives once (their rule is the same).
REPEATED = {"ability score improvement"}


def norm(name: str) -> str:
    n = name.lower().replace("’", "'").replace("-", " ")
    n = re.sub(r"\s*\(.*?\)", "", n)
    n = re.sub(r"^spellcasting: .*", "spellcasting", n)
    return re.sub(r"[^a-z0-9 ]", "", n).replace("  ", " ").strip()


def stripped(name: str) -> str:
    n = norm(name)
    for prefix in PREFIXES:
        if n.startswith(prefix + " "):
            return n[len(prefix) + 1 :]
    return n


def srd_entries(filename: str):
    names = json.loads((REPO / f"locales/en/srd51/{filename}.json").read_text(encoding="utf8"))
    data = json.loads((REPO / f"data/srd51/{filename}.json").read_text(encoding="utf8"))["entries"]
    for e in data:
        slug = e["id"].split("/", 1)[1]
        yield e, names.get(f"{slug}.name", slug)


def read_elements(paths):
    found = []
    for path in paths:
        for el in ET.parse(path).getroot().iter("element"):
            found.append(el)
    return found


def main():
    pairs: dict[str, list[str]] = defaultdict(list)
    unpaired: dict[str, list[str]] = defaultdict(list)

    # Class and archetype features, in the scope of each class.
    classes = {}
    for e, _ in srd_entries("classes"):
        classes[e["id"].split("/")[1]] = e["id"]
    def names_in(paths, types=("Class Feature", "Archetype Feature")):
        by_name = defaultdict(list)
        for el in read_elements([p for p in paths if p.exists()]):
            if el.get("type") in types:
                by_name[norm(el.get("name", ""))].append(el.get("id"))
        return by_name

    fighter = names_in([AURORA / "classes/class-fighter.xml"])
    for slug in classes:
        own = names_in([AURORA / f"classes/class-{slug}.xml"])
        sub = names_in([AURORA / f"archetypes/{SUBCLASS_FILE[slug]}.xml"])
        extra = names_in([AURORA / "eldritch-invocations.xml"]) if slug == "warlock" else {}
        for e, name in srd_entries("features"):
            if e["data"]["class"].split("/")[1] != slug:
                continue
            n = norm(name)
            if n in REPEATED or PLACEHOLDER.search(n):
                continue
            found = []
            for key in (n, stripped(name)):
                # The class first, then its subclass, then the shared lists.
                for scope in (own, sub, extra, fighter if key.startswith(("archery", "defense", "dueling", "great weapon", "protection", "two weapon")) or n.startswith("fighting style") else {}):
                    if len(scope.get(key, [])) == 1:
                        found = scope[key]
                        break
                    if len(scope.get(key, [])) > 1:
                        break
                if found:
                    break
            if found:
                if e["id"] not in pairs[found[0]]:
                    pairs[found[0]].append(e["id"])
            else:
                unpaired[slug].append((e["id"], f"{name} @{e['data']['level']}"))

    # Racial traits, in the scope of the file of each species.
    files = {
        "dragonborn": "race-dragonborn.xml", "dwarf": "race-dwarf.xml", "elf": "race-elf.xml",
        "gnome": "race-gnome.xml", "half-elf": "race-halfelf.xml", "halfling": "race-halfling.xml",
        "half-orc": "race-halforc.xml", "human": "race-human.xml", "tiefling": "race-tiefling.xml",
    }
    traits_of = defaultdict(set)  # species file -> SRD trait ids
    for filename in ("species", "subspecies"):
        for e, _ in srd_entries(filename):
            slug = e["id"].split("/")[1]
            owner = e.get("parent", e["id"]).split("/")[1] if filename == "subspecies" else slug
            if filename == "subspecies":
                owner = {"hill-dwarf": "dwarf", "high-elf": "elf", "lightfoot-halfling": "halfling", "rock-gnome": "gnome"}[slug]
            for effect in e["effects"]:
                if effect.get("type") == "trait":
                    traits_of[owner].add(effect["id"])
    exact = lambda name: re.sub(r"\s+", " ", name.lower().replace("’", "'")).strip()
    srd_traits = {exact(n): e["id"] for e, n in srd_entries("traits")}
    for species, filename in files.items():
        seen = defaultdict(list)
        for el in read_elements([AURORA / "races" / filename]):
            if el.get("type") == "Racial Trait":
                seen[exact(el.get("name", ""))].append(el.get("id"))
        for name, ids in seen.items():
            if name in srd_traits and len(ids) == 1 and srd_traits[name] not in pairs[ids[0]]:
                pairs[ids[0]].append(srd_traits[name])
        for trait in sorted(traits_of.get(species, [])):
            if not any(trait in v for v in pairs.values()):
                unpaired["species/" + species].append((trait, trait))

    # The subclasses: the SRD says "Berserker", Aurora "Path of the Berserker". Each class has one in
    # the SRD, and its file of Aurora holds the one element of type Archetype.
    for slug, filename in SUBCLASS_FILE.items():
        archetypes = [
            el for el in read_elements([AURORA / f"archetypes/{filename}.xml"]) if el.get("type") == "Archetype"
        ]
        srd_subclass = next(e["id"] for e, _ in srd_entries("subclasses") if e["parent"] == classes[slug])
        assert len(archetypes) == 1, f"{filename}: {len(archetypes)} archetypes"
        pairs[archetypes[0].get("id")] = [srd_subclass]

    # Every element written by hand must exist in the books, or the pair would never be used.
    known = {el.get("id") for el in read_elements(glob.glob(str(AURORA / "**/*.xml"), recursive=True))}
    missing = [aid for aid in MANUAL if aid not in known]
    assert not missing, f"MANUAL names elements that are not in the books: {missing}"

    for aid, ids in MANUAL.items():
        pairs[aid] = ids

    ordered = {aid: sorted(ids) for aid, ids in sorted(pairs.items())}
    OUT.write_text(json.dumps(ordered, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
    total = sum(len(v) for v in ordered.values())
    print(f"{len(ordered)} Aurora elements paired with {total} entries of the app -> {OUT.relative_to(REPO)}")
    done = {i for ids in ordered.values() for i in ids}
    print("\nnot paired (the SRD alone, or no counterpart in the book):")
    for scope, rows in unpaired.items():
        names = [label for entry, label in rows if entry not in done]
        if names:
            print(f"  {scope} ({len(names)}): " + "; ".join(names))


main()
