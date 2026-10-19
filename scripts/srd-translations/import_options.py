"""Imports the options a class offers (invocations, metamagic, fighting styles, pact boons) and
the features that only repeat another one, from an official SRD 5.1 translation.

    python scripts/srd-translations/import_options.py it path/to/SRD_CC_v5.1_IT.pdf

Run it after `import_classes.py`: it adds to the features file instead of replacing it.

Every option has a section of its own in the PDF, listed under its parent feature. The script
finds the parent as the section whose number of sections with text equals the English count
and whose text length is closest, pairs the children with the English entries by length and
numbers, and writes `Parent: Option` names where the English name has that shape.
"""

import json
import math
import re
import sys
from pathlib import Path

from import_classes import CLASSES, merge_split_headings, tokens
from import_reference import ROOT, key, load_en
from import_spells import hungarian
from pdf_sections import Section, read_sections

# English slug prefix -> (class slug, whether names read "Parent: Option")
FAMILIES = {
    "eldritch-invocation-": ("warlock", True),
    "metamagic-": ("sorcerer", True),
    "fighter-fighting-style-": ("fighter", True),
    "ranger-fighting-style-": ("ranger", True),
    "fighting-style-": ("paladin", True),
    "pact-of-the-": ("warlock", False),
}

# Dragon colours as the translations write them, for the sorcerer's Dragon Ancestor.
COLORS = {
    "it": {"black": "Nero", "blue": "Blu", "brass": "Ottone", "bronze": "Bronzo", "copper": "Rame",
           "gold": "Oro", "green": "Verde", "red": "Rosso", "silver": "Argento", "white": "Bianco"},
    "fr": {"black": "Noir", "blue": "Bleu", "brass": "Airain", "bronze": "Bronze", "copper": "Cuivre",
           "gold": "Or", "green": "Vert", "red": "Rouge", "silver": "Argent", "white": "Blanc"},
    "de": {"black": "Schwarz", "blue": "Blau", "brass": "Messing", "bronze": "Bronze", "copper": "Kupfer",
           "gold": "Gold", "green": "Gruen", "red": "Rot", "silver": "Silber", "white": "Weiss"},
    "es": {"black": "Negro", "blue": "Azul", "brass": "Laton", "bronze": "Bronce", "copper": "Cobre",
           "gold": "Oro", "green": "Verde", "red": "Rojo", "silver": "Plata", "white": "Blanco"},
}


# Pairs the matcher gets wrong, checked by reading the PDF: option -> the heading it belongs to.
OVERRIDES = {
    "it": {
        "eldritch-invocation-sign-of-ill-omen": "Presagio di sventura",
        "eldritch-invocation-thirsting-blade": "Lama assetata",
    },
    "de": {
        "eldritch-invocation-agonizing-blast": "Qualvoller Strahl",
        "eldritch-invocation-thirsting-blade": "D\u00fcrstende Klinge",
    },
}


def load_target(lang: str, name: str) -> dict:
    path = ROOT / "locales" / lang / "srd51" / f"{name}.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def save_target(lang: str, name: str, values: dict) -> None:
    english = load_en(name)
    out = {k: values[k] for k in english if values.get(k)}
    path = ROOT / "locales" / lang / "srd51" / f"{name}.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def family_slugs(prefix: str, all_slugs: list[str]) -> list[str]:
    found = [s for s in all_slugs if s.startswith(prefix) and not re.fullmatch(r"metamagic-\d", s)]
    if prefix == "fighting-style-":  # the paladin's own: the others carry their class first
        found = [s for s in found if not s.startswith(("fighter-", "ranger-"))]
    return found


def children_of(chapter: list[Section]) -> list[tuple[Section, list[Section]]]:
    """Every section of the chapter with the sections below it that have text."""
    out = []
    for j, head in enumerate(chapter):
        kids = []
        for k in range(j + 1, len(chapter)):
            if chapter[k].level <= head.level:
                break
            if chapter[k].body:
                kids.append(chapter[k])
        out.append((head, kids))
    return out


def best_container(chapter, count: int, english_total: int):
    best = None
    for head, kids in children_of(chapter):
        if len(kids) != count:
            continue
        text = sum(len(" ".join(k.body)) for k in kids)
        score = abs(math.log(max(text, 1) / max(english_total, 1) / 1.2))
        if best is None or score < best[0]:
            best = (score, head, kids)
    return best


def spell_names(lang: str) -> list[tuple[str, str]]:
    """(English, translated) names of spells, abilities, skills and conditions: words that turn
    up in a feature's text and are a safe bridge between the English text and a translation."""
    pairs = []
    for name in ("spells", "abilities", "skills", "conditions"):
        en = load_en(name)
        tr = load_target(lang, name)
        for k, v in en.items():
            if k.endswith(".name") and tr.get(k) and len(v) >= 3:
                pairs.append((v, tr[k].strip()))
    return sorted(pairs, key=lambda p: -len(p[0]))


def mentions(text: str, spells: list[tuple[str, str]], translated: bool) -> set[str]:
    low = text.lower()
    found = set()
    for en, tr in spells:
        word = (tr if translated else en).lower()
        if re.search(rf"(?<!\w){re.escape(word)}(?!\w)", low):
            found.add(en)
    return found


def pair(kids: list[Section], slugs: list[str], descs: dict, spells: list[tuple[str, str]]):
    cost = [[400.0] * len(kids) for _ in kids]
    for r, kid in enumerate(kids):
        text = " ".join(kid.body)
        seen = mentions(text, spells, True)
        for c, slug in enumerate(slugs):
            en = descs.get(slug, "")
            length = abs(math.log(max(len(text), 1) / max(len(en), 1) / 1.2)) * 30
            shared = len(tokens(text) & tokens(en)) - len(tokens(text) ^ tokens(en)) * 0.3
            wanted = mentions(en, spells, False)
            spell = len(seen & wanted) * 60 - len(seen ^ wanted) * 25
            cost[r][c] = length - shared * 12 - spell
    return {c: (kids[r], cost[r][c]) for r, c in enumerate(hungarian(cost)) if c < len(slugs)}


def run(lang: str, pdf: Path) -> None:
    secs = merge_split_headings(read_sections(pdf, dehyphenate=(lang == "de")))
    en = load_en("features")
    names = {k[:-5]: v for k, v in en.items() if k.endswith(".name")}
    descs = {k[:-5]: v for k, v in en.items() if k.endswith(".desc")}
    out = load_target(lang, "features")
    all_slugs = sorted(names)
    notes = []
    spells = spell_names(lang)

    chapters = [i for i, s in enumerate(secs) if s.level == 1 and key(s.title) in CLASSES[lang]]
    for i in chapters:
        slug = CLASSES[lang][key(secs[i].title)]
        end = next((j for j in range(i + 1, len(secs)) if secs[j].level == 1), len(secs))
        chapter = secs[i:end]
        for prefix, (owner, prefixed) in FAMILIES.items():
            if owner != slug:
                continue
            slugs = family_slugs(prefix, all_slugs)
            if not slugs:
                continue
            total = sum(len(descs.get(s, "")) for s in slugs)
            found = best_container(chapter, len(slugs), total)
            if not found:
                notes.append(f"{slug}: no container for {prefix} ({len(slugs)})")
                continue
            _, head, kids = found
            matched = pair(kids, slugs, descs, spells)
            fixed = OVERRIDES.get(lang, {})
            for c, slug_c in enumerate(slugs):
                title = fixed.get(slug_c)
                section = next((k for k in kids if k.title == title), None) if title else None
                if section:
                    matched[c] = (section, -999.0)
            for c, (section, price) in matched.items():
                s = slugs[c]
                notes.append(f"  {s} -> {section.title} ({price:.0f})")
                if "-t" in sys.argv and not s.endswith(("-defense", "-dueling", "-archery")):
                    body = " ".join(section.body)[:90]
                    print(f"{s} [{price:.0f}]\n   EN: {descs.get(s, '')[:90]}\n   {lang.upper()}: {section.title}: {body}")
                if price > -30 and "-r" in sys.argv:
                    body = " ".join(section.body)[:160]
                    print(f"[{price:.0f}] {s}\n   EN: {descs.get(s, '')[:160]}\n   {lang.upper()}: {section.title}: {body}")
                out[f"{s}.name"] = f"{head.title}: {section.title}" if prefixed else section.title
                out[f"{s}.desc"] = "\n\n".join(section.body)
            notes.append(f"{slug}: {prefix} {len(matched)}/{len(slugs)} under '{head.title}'")

    # Features that only repeat another one: the same text under a name with a suffix.
    done = {s for s in all_slugs if out.get(f"{s}.name") and out.get(f"{s}.desc")}
    by_desc: dict[str, str] = {}
    for s in done:
        by_desc.setdefault(descs.get(s, ""), s)
    colors = COLORS[lang]
    for s in all_slugs:
        if s in done or not descs.get(s):
            continue
        base = by_desc.get(descs[s])
        if not base:
            continue
        name = out[f"{base}.name"]
        m = re.match(r"dragon-ancestor-(\w+)---", s)
        if m:
            name = f"{name}: {colors[m.group(1)]}"
        out[f"{s}.name"] = name
        out[f"{s}.desc"] = out[f"{base}.desc"]
        notes.append(f"  copy {s} <- {base}")

    save_target(lang, "features", out)
    print(lang, "features", len([k for k in out if out[k]]))
    if "-v" in sys.argv:
        print("\n".join(notes))


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    run(sys.argv[1], Path(sys.argv[2]))
