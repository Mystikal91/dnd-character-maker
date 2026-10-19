"""Fills small gaps that the PDFs leave, from texts that are already translated.

    python scripts/srd-translations/import_misc.py it

- Draconic Ancestry has one trait per dragon colour in the data; the PDF has one table. Each
  trait gets the translated name of the base trait, the colour in brackets, and its text.
- The Italian SRD leaves four conditions out of its appendix; their names, as the Italian
  rules call them, are added so the texts that mention them read right (the English
  description stays until a translation is reviewed in Weblate).

Run it after `import_species.py`, `import_tables.py` and `import_options.py`.
"""

import sys

from import_options import COLORS, load_target, save_target
from import_reference import load_en

ITALIAN_CONDITIONS = {
    "frightened": "Spaventato",
    "prone": "Prono",
    "restrained": "Trattenuto",
    "stunned": "Stordito",
}


def run(lang: str) -> None:
    english = load_en("traits")
    out = load_target(lang, "traits")
    base_name = out.get("draconic-ancestry.name")
    base_desc = out.get("draconic-ancestry.desc")
    colors = COLORS[lang]
    added = 0
    if base_name and base_desc:
        for key_ in english:
            if not key_.startswith("draconic-ancestry-") or not key_.endswith(".name"):
                continue
            slug = key_[:-5]
            color = colors.get(slug.removeprefix("draconic-ancestry-"))
            if color and not out.get(f"{slug}.name"):
                out[f"{slug}.name"] = f"{base_name} ({color})"
                out[f"{slug}.desc"] = base_desc
                added += 1
    save_target(lang, "traits", out)

    conditions = 0
    if lang == "it":
        names = load_target(lang, "conditions")
        for slug, name in ITALIAN_CONDITIONS.items():
            if not names.get(f"{slug}.name"):
                names[f"{slug}.name"] = name
                conditions += 1
        save_target(lang, "conditions", names)
    print(lang, "draconic ancestry", added, "conditions", conditions)


if __name__ == "__main__":
    sys.path.insert(0, __file__.rsplit("/", 1)[0].rsplit("\\", 1)[0])
    run(sys.argv[1])
