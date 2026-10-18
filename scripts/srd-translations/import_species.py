"""Imports species, subspecies and trait texts from an official SRD 5.1 translation.

    python scripts/srd-translations/import_species.py it path/to/SRD_CC_v5.1_IT.pdf

Each species chapter has the same shape in every language: a traits section whose run-in
paragraphs ("Darkvision. ...") are the standard fields (age, alignment, size, speed, languages)
followed by the species' traits, then one subspecies section. Species are paired with English
ids through a glossary; traits are paired inside each species by length and numbers (their
order differs from the English data).
"""

import json
import math
import re
import sys
from pathlib import Path

from import_reference import key, load_en, write
from import_spells import hungarian
from pdf_sections import read_sections

ROOT = Path(__file__).resolve().parents[2]

# Translated species heading (key() form) -> English id.
SPECIES = {
    "it": {"nano": "dwarf", "elfo": "elf", "halfling": "halfling", "umano": "human",
           "dragonide": "dragonborn", "gnomo": "gnome", "mezzelfo": "half-elf",
           "mezzorco": "half-orc", "tiefling": "tiefling"},
    "fr": {"nain": "dwarf", "elfe": "elf", "halfelin": "halfling", "humain": "human",
           "drakeide": "dragonborn", "gnome": "gnome", "demi-elfe": "half-elf",
           "demi-orc": "half-orc", "tieffelin": "tiefling"},
    "de": {"zwerg": "dwarf", "elf": "elf", "halbling": "halfling", "mensch": "human",
           "drachenbluetige": "dragonborn", "gnom": "gnome", "halbelf": "half-elf",
           "halbork": "half-orc", "tiefling": "tiefling"},
    "es": {"enano": "dwarf", "elfo": "elf", "mediano": "halfling", "humano": "human",
           "draconido": "dragonborn", "gnomo": "gnome", "semielfo": "half-elf",
           "semiorco": "half-orc", "tiefling": "tiefling"},
}

# Run-in names of the standard fields (key() form prefixes) -> the English field they fill.
FIELDS = {
    "it": {"eta": "age", "allineamento": "alignment", "taglia": "sizeDescription",
           "linguaggi": "languageDescription", "velocita": None, "incremento": None},
    "fr": {"age": "age", "alignement": "alignment", "categorie de taille": "sizeDescription",
           "taille": "sizeDescription", "langues": "languageDescription", "vitesse": None,
           "augmentation": None},
    "de": {"alter": "age", "gesinnung": "alignment", "groesse": "sizeDescription",
           "sprachen": "languageDescription", "bewegungsrate": None, "attributswerterhoehung": None},
    "es": {"edad": "age", "alineamiento": "alignment", "tamano": "sizeDescription",
           "idiomas": "languageDescription", "velocidad": None, "mejora": None},
}

RUN_IN = re.compile(r"^([^.:\-\d][^.:]{1,44})[.:] (.+)$")


def run_ins(paragraphs: list[str]) -> list[tuple[str, str]]:
    out = []
    for p in paragraphs:
        m = RUN_IN.match(p)
        if m and len(m.group(1).split()) <= 5 and not p.startswith("- "):
            out.append((m.group(1).strip(), m.group(2).strip()))
    return out


def is_standard(name: str, prefix: str) -> bool:
    """True when a run-in name is the standard field `prefix` (not just a longer word)."""
    k = key(name)
    return k == prefix or k.startswith(prefix + " ")


def tokens(text: str) -> set[str]:
    return set(re.findall(r"\d+d\d+|\d+", text))


def assign_traits(found: list[tuple[str, str]], slugs: list[str], english: dict) -> dict:
    """Pairs run-in paragraphs with trait slugs by text length, shared numbers and order.

    The English data and the PDFs list a species' traits in nearly the same order, so order
    counts, but a trait is sometimes moved (the elf's Keen Senses), so length decides first.
    """
    size = max(len(found), len(slugs))
    cost = [[300.0] * size for _ in range(size)]
    for r, (_, text) in enumerate(found):
        for c, slug in enumerate(slugs):
            en = english.get(f"{slug}.desc", "")
            length = abs(math.log(max(len(text), 1) / max(len(en), 1) / 1.2)) * 30
            shared = len(tokens(text) & tokens(en)) - len(tokens(text) ^ tokens(en)) * 0.3
            cost[r][c] = length + abs(r - c) * 8 - shared * 15
    result = {}
    for r, c in enumerate(hungarian(cost)):
        if r < len(found) and c < len(slugs):
            result[slugs[c]] = found[r]
    return result


def run(lang: str, pdf: Path) -> None:
    secs = read_sections(pdf, dehyphenate=(lang == "de"))
    species_data = json.loads((ROOT / "data/srd51/species.json").read_text(encoding="utf-8"))["entries"]
    sub_data = json.loads((ROOT / "data/srd51/subspecies.json").read_text(encoding="utf-8"))["entries"]
    traits_en = load_en("traits")
    species_en = load_en("species")

    def trait_slugs(entry: dict) -> list[str]:
        return [e["id"].split("/")[1] for e in entry["effects"] if e["type"] == "trait"]

    sub_of = {e["parent"].split("/")[1]: e for e in sub_data}
    species_values: dict = {}
    sub_values: dict = {}
    trait_names: dict[str, list[str]] = {}
    trait_descs: dict[str, tuple[str, str]] = {}
    owners: dict[str, int] = {}
    review: list[str] = []

    for i, s in enumerate(secs):
        if s.level != 2:
            continue
        slug = SPECIES[lang].get(key(s.title))
        if not slug:
            continue
        # Everything up to the next level-2 section belongs to this species.
        end = next((j for j in range(i + 1, len(secs)) if secs[j].level <= 2), len(secs))
        block = secs[i + 1 : end]
        # The traits section is the first level-3 with text (the German human has none: its
        # run-in paragraphs sit directly under the species heading).
        traits = next((b for b in block if b.level == 3 and b.body), s if s.body else None)
        sub = next((b for b in block if b.level == 4 and b.body), None)
        if not traits:
            continue
        species_values[f"{slug}.name"] = s.title

        standard = FIELDS[lang]
        extra = []
        for name, text in run_ins(traits.body):
            field = next((f for k, f in standard.items() if is_standard(name, k)), "?")
            if field == "?":
                extra.append((name, text))
            elif field:
                species_values[f"{slug}.{field}"] = text
        entry = next(e for e in species_data if e["id"].endswith(f"/{slug}"))
        wanted = [t for t in trait_slugs(entry) if t in traits_en or f"{t}.name" in traits_en]
        pairs = assign_traits(extra, wanted, traits_en)
        for t, (name, text) in pairs.items():
            trait_names.setdefault(t, []).append(name)
            trait_descs[t] = (name, text)
            owners[t] = owners.get(t, 0) + 1
            review.append(f"{slug}/{t} = {name}")

        sub_entry = sub_of.get(slug)
        if sub and sub_entry:
            sub_slug = sub_entry["id"].split("/")[1]
            sub_values[f"{sub_slug}.name"] = sub.title
            if sub.body and not RUN_IN.match(sub.body[0].split(". ")[0] + ". x"):
                sub_values[f"{sub_slug}.desc"] = sub.body[0]
            sub_extra = []
            for name, text in run_ins(sub.body):
                if not any(is_standard(name, k) for k in standard):
                    sub_extra.append((name, text))
            sub_wanted = [t for t in trait_slugs(sub_entry) if f"{t}.name" in traits_en]
            for t, (name, text) in assign_traits(sub_extra, sub_wanted, traits_en).items():
                trait_names.setdefault(t, []).append(name)
                trait_descs[t] = (name, text)
                owners[t] = owners.get(t, 0) + 1
                review.append(f"{sub_slug}/{t} = {name}")

    trait_values = {}
    for t, names in trait_names.items():
        # A shared trait repeats under each species: the most common spelling wins.
        trait_values[f"{t}.name"] = max(set(names), key=names.count)
        if owners[t] == 1:  # text of a shared trait differs by species; keep it in English
            trait_values[f"{t}.desc"] = trait_descs[t][1]
    print(lang, "species", write(lang, "species", species_values), "of", len(species_en))
    print(lang, "subspecies", write(lang, "subspecies", sub_values))
    print(lang, "traits", write(lang, "traits", trait_values))
    conflicts = {t: sorted(set(n)) for t, n in trait_names.items() if len(set(n)) > 1}
    if conflicts:
        print("  trait names that differ between species:", conflicts)
    if "-v" in sys.argv:
        print("\n".join(review))


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    run(sys.argv[1], Path(sys.argv[2]))
