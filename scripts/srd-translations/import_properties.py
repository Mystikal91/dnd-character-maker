"""Imports the weapon property texts from an official SRD 5.1 translation.

    python scripts/srd-translations/import_properties.py it path/to/SRD_CC_v5.1_IT.pdf

The "weapon properties" section lists each property as a run-in paragraph ("Finesse. ...") in
the alphabetical order of the language, optionally followed by more paragraphs. The heading of
each property is paired with the English slug through a small glossary.
"""

import json
import re
import sys
from pathlib import Path

from import_reference import ROOT, key, load_en
from import_options import load_target, save_target
from pdf_sections import read_sections

# Run-in heading (key() form) -> English slug.
GLOSSARY = {
    "it": {"munizioni": "ammunition", "accurata": "finesse", "pesante": "heavy", "leggera": "light",
           "ricarica": "loading", "gittata": "range", "portata": "reach", "speciale": "special",
           "lancio": "thrown", "due mani": "two-handed", "versatile": "versatile"},
    "fr": {"munitions": "ammunition", "finesse": "finesse", "lourde": "heavy", "legere": "light",
           "chargement": "loading", "portee": "range", "allonge": "reach", "speciale": "special",
           "lancer": "thrown", "a deux mains": "two-handed", "polyvalente": "versatile"},
    "de": {"geschosse": "ammunition", "finesse": "finesse", "schwer": "heavy", "leicht": "light",
           "laden": "loading", "reichweite": "range", "weitreichend": "reach", "besonders": "special",
           "wurfwaffe": "thrown", "zweihaendig": "two-handed", "vielseitig": "versatile"},
    "es": {"municion": "ammunition", "sutil": "finesse", "pesada": "heavy", "ligera": "light",
           "recarga": "loading", "alcance": "range", "gran alcance": "reach", "especial": "special",
           "arrojadiza": "thrown", "a dos manos": "two-handed", "versatil": "versatile"},
}
TITLES = {"it": "propriet", "fr": "proprietes des armes", "de": "waffeneigenschaften",
          "es": "propiedades de las armas"}
RUN_IN = re.compile(r"^([^.:]{2,30})[.:] (.+)$", re.S)


def run(lang: str, pdf: Path) -> None:
    secs = read_sections(pdf, dehyphenate=(lang == "de"))
    section = next(s for s in secs if s.level in (3, 4) and key(s.title).startswith(TITLES[lang]))
    english = load_en("properties")
    names = {k[:-5] for k in english if k.endswith(".name")}
    found: dict[str, tuple[str, list[str]]] = {}
    current = None
    for paragraph in section.body:
        m = RUN_IN.match(paragraph)
        slug = GLOSSARY[lang].get(key(m.group(1))) if m else None
        if slug:
            current = slug
            found[slug] = (m.group(1).strip(), [m.group(2).strip()])
        elif current:
            found[current][1].append(paragraph.strip())
    out = load_target(lang, "properties")
    for slug, (name, parts) in found.items():
        if slug in names:
            out[f"{slug}.name"] = name
            out[f"{slug}.desc"] = "\n\n".join(parts)
    save_target(lang, "properties", out)
    print(lang, "properties", len(found), "of", len(names))


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    run(sys.argv[1], Path(sys.argv[2]))
