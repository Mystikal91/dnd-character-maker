"""Imports abilities, skills, conditions and alignments from an official SRD 5.1 translation.

    python scripts/srd-translations/import_reference.py it path/to/SRD_CC_v5.1_IT.pdf

Needs PyMuPDF. Sections are found by shape (see reference.py); the few names that must be
paired with English ids (skills, conditions) go through the glossaries below, written from the
translated headings and checked against the PDFs.
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

import reference as ref
from pdf_sections import read_sections

ROOT = Path(__file__).resolve().parents[2]


def plain(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", text.lower()) if not unicodedata.combining(c)
    ).strip()


# Translated heading (lowercase, no accents) -> English id.
SKILLS = {
    "it": {
        "acrobazia": "acrobatics", "furtivita": "stealth", "rapidita di mano": "sleight-of-hand",
        "atletica": "athletics", "arcano": "arcana", "indagare": "investigation",
        "natura": "nature", "religione": "religion", "storia": "history",
        "addestrare animali": "animal-handling", "intuizione": "insight", "medicina": "medicine",
        "percezione": "perception", "sopravvivenza": "survival", "inganno": "deception",
        "intimidire": "intimidation", "intrattenere": "performance", "persuasione": "persuasion",
    },
    "fr": {
        "athletisme": "athletics", "acrobaties": "acrobatics", "discretion": "stealth",
        "escamotage": "sleight-of-hand", "arcanes": "arcana", "histoire": "history",
        "investigation": "investigation", "nature": "nature", "religion": "religion",
        "dressage": "animal-handling", "intuition": "insight", "medecine": "medicine",
        "perception": "perception", "survie": "survival", "intimidation": "intimidation",
        "persuasion": "persuasion", "representation": "performance", "tromperie": "deception",
    },
    "de": {
        "akrobatik": "acrobatics", "athletik": "athletics", "auftreten": "performance",
        "einschuechtern": "intimidation", "fingerfertigkeit": "sleight-of-hand",
        "geschichte": "history", "heilkunde": "medicine", "heimlichkeit": "stealth",
        "motiv erkennen": "insight", "mit tieren umgehen": "animal-handling",
        "nachforschungen": "investigation", "naturkunde": "nature", "religion": "religion",
        "taschenspielerei": "sleight-of-hand", "arkane kunde": "arcana",
        "taeuschen": "deception", "taeuschung": "deception", "ueberlebenskunst": "survival", "ueberleben": "survival",
        "ueberzeugen": "persuasion", "wahrnehmung": "perception", "arkanes wissen": "arcana",
    },
    "es": {
        "atletismo": "athletics", "acrobacias": "acrobatics", "juego de manos": "sleight-of-hand",
        "sigilo": "stealth", "conocimiento arcano": "arcana", "historia": "history",
        "investigacion": "investigation", "naturaleza": "nature", "religion": "religion",
        "medicina": "medicine", "percepcion": "perception", "perspicacia": "insight",
        "supervivencia": "survival", "trato con animales": "animal-handling",
        "engano": "deception", "interpretacion": "performance", "intimidacion": "intimidation",
        "persuasion": "persuasion",
    },
}
CONDITIONS = {
    "it": {
        "accecato": "blinded", "affascinato": "charmed", "afferrato": "grappled",
        "assordato": "deafened", "avvelenato": "poisoned", "incapacitato": "incapacitated",
        "indebolimento": "exhaustion", "invisibile": "invisible", "paralizzato": "paralyzed",
        "pietrificato": "petrified", "privo di sensi": "unconscious",
    },
    "fr": {
        "a terre": "prone", "agrippe": "grappled", "assourdi": "deafened", "aveugle": "blinded",
        "charme": "charmed", "effraye": "frightened", "empoisonne": "poisoned",
        "entrave": "restrained", "epuisement": "exhaustion", "etourdi": "stunned",
        "inconscient": "unconscious", "invisible": "invisible", "neutralise": "incapacitated",
        "paralyse": "paralyzed", "petrifie": "petrified",
    },
    "de": {
        "betaeubt": "stunned", "bewusstlos": "unconscious", "bezaubert": "charmed",
        "blind": "blinded", "festgesetzt": "restrained", "gelaehmt": "paralyzed",
        "gepackt": "grappled", "kampfunfaehig": "incapacitated", "liegend": "prone",
        "taub": "deafened", "erschoepfung": "exhaustion", "unsichtbar": "invisible",
        "veraengstigt": "frightened", "vergiftet": "poisoned", "versteinert": "petrified",
    },
    "es": {
        "agarrado": "grappled", "apresado": "restrained", "asustado": "frightened",
        "aturdido": "stunned", "cegado": "blinded", "derribado": "prone",
        "ensordecido": "deafened", "cansancio": "exhaustion", "envenenado": "poisoned",
        "hechizado": "charmed", "incapacitado": "incapacitated", "inconsciente": "unconscious",
        "invisible": "invisible", "paralizado": "paralyzed", "petrificado": "petrified",
    },
}


def key(title: str) -> str:
    """Glossary key: lowercase, accents removed (umlauts spelled out as German does)."""
    t = title.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    return plain(t)


def load_en(name: str) -> dict:
    return json.loads((ROOT / f"locales/en/srd51/{name}.json").read_text(encoding="utf-8"))


def write(lang: str, name: str, values: dict) -> int:
    english = load_en(name)
    out = {k: values[k] for k in english if values.get(k)}
    target = ROOT / "locales" / lang / "srd51"
    target.mkdir(parents=True, exist_ok=True)
    (target / f"{name}.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return len(out)


def trim_list_intro(text: str) -> str:
    """Drop a closing sentence that only introduces a list ("Examples include:")."""
    if not text.rstrip().endswith(":"):
        return text
    cut = max(text.rfind(". ", 0, len(text) - 1), text.rfind("? "), text.rfind("! "))
    return text[: cut + 1] if cut > 0 else text.rstrip(":")


def run(lang: str, pdf: Path) -> None:
    from import_spells import pdf_lines, LANGUAGES  # reuse the noise-free line reader

    secs = read_sections(pdf, dehyphenate=(lang == "de"))
    lines = pdf_lines(pdf, LANGUAGES[lang]["noise"])

    # Abilities
    sections = ref.abilities(secs)
    abbreviations = ref.ability_abbreviations(lines)
    values = {}
    for slug, (head, checks), abbr in zip(ref.ABILITY_ORDER, sections, abbreviations):
        values[f"{slug}.name"] = head.title
        values[f"{slug}.abbreviation"] = abbr
        if head.body and checks.body:
            values[f"{slug}.desc"] = "\n\n".join([head.body[0], checks.body[0]])
    print(lang, "abilities", write(lang, "abilities", values))

    # Skills
    counts = {"str": 1, "dex": 3, "con": 0, "int": 5, "wis": 5, "cha": 4}
    found = ref.skills_by_ability([c for _, c in sections], counts)
    values, unknown = {}, []
    for items in found.values():
        for name, text in items:
            slug = SKILLS[lang].get(key(name))
            if not slug:
                unknown.append(name)
                continue
            values[f"{slug}.name"] = name
            values[f"{slug}.desc"] = trim_list_intro(text)
    print(lang, "skills", write(lang, "skills", values), "unknown:", unknown)

    # Conditions (exhaustion keeps its English text: its table is not in the running text)
    values, unknown = {}, []
    for section in ref.conditions(secs):
        slug = CONDITIONS[lang].get(key(section.title))
        if not slug:
            unknown.append(section.title)
            continue
        values[f"{slug}.name"] = section.title
        if slug != "exhaustion" and section.body:
            values[f"{slug}.desc"] = "\n\n".join(section.body)
    print(lang, "conditions", write(lang, "conditions", values), "unknown:", unknown)

    # The single background of the SRD: a level-3 section whose first level-4 child is the
    # background feature, titled "Feature: Name" in every language.
    from import_classes import CLASSES  # local import: import_classes imports this module

    values = {}
    after_classes = max(
        (i for i, s in enumerate(secs) if s.level == 1 and key(s.title) in CLASSES[lang]), default=0
    )
    for i, section in enumerate(secs):
        if i < after_classes:
            continue
        nxt = secs[i + 1] if i + 1 < len(secs) else None
        if section.level == 3 and nxt and nxt.level == 4 and ":" in nxt.title and nxt.body:
            values["acolyte.name"] = section.title
            values["acolyte.featureName"] = nxt.title.split(":", 1)[1].strip()
            values["acolyte.featureDesc"] = "\n\n".join(nxt.body)
            break
    print(lang, "backgrounds", write(lang, "backgrounds", values))

    # Alignments: the PDF gives the abbreviation and the paragraph; names are not set as headings.
    english = load_en("alignments")
    slugs = [k.split(".")[0] for k in english if k.endswith(".abbreviation")]
    values = {}
    for slug, (abbr, text) in zip(slugs, ref.alignments(secs)):
        values[f"{slug}.abbreviation"] = abbr
        values[f"{slug}.desc"] = text
    print(lang, "alignments", write(lang, "alignments", values))


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    run(sys.argv[1], Path(sys.argv[2]))
