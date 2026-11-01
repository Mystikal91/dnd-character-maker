"""Imports the magic items from an official SRD 5.1 translation.

    python scripts/srd-translations/import_magic_items.py it path/to/SRD_CC_v5.1_IT.pdf

Run it after `npm run data:srd51`. The "Magic Items A-Z" chapter has one section per item, in the
alphabetical order of the translation, so each section is paired with an English item by what does
not change between languages: the rarity, the attunement, the kind of item and the numbers and
dice in the text (the Hungarian method of `import_spells.py`). The items that are variants of one
section of the PDF (the +1, +2 and +3 weapons, the colours of the dragon scale mail) have no section
of their own: they keep the English text until someone translates them.
"""

import collections
import json
import re
import sys
from pathlib import Path

from import_reference import ROOT, load_en, plain
from import_options import load_target, save_target
from import_spells import hungarian, tokens
from pdf_sections import read_sections

# Rarity words of each translation, longest first, and the English slug each stands for.
CONFIG = {
    "it": {
        "rarities": [
            ("rarità variabile", "varies"),
            ("molto raro", "very-rare"),
            ("molto rara", "very-rare"),
            ("non comune", "uncommon"),
            ("leggendario", "legendary"),
            ("leggendaria", "legendary"),
            ("artefatto", "artifact"),
            ("comune", "common"),
            ("raro", "rare"),
            ("rara", "rare"),
        ],
        "attunement": "richiede sintonia",
        # The first word of the type line, and the category of the English data it stands for.
        "kinds": {
            "arma": "weapon",
            "armatura": "armor",
            "anello": "ring",
            "bacchetta": "wand",
            "bastone": "staff",
            "verga": "rod",
            "pozione": "potion",
            "pergamena": "scroll",
            "oggetto meraviglioso": "wondrous-items",
            "munizioni": "ammunition",
        },
        "chapter": "Oggetti magici A–Z",
        "end": "Oggetti magici senzienti",
    }
}


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def parse(lang: str, pdf: Path) -> list[dict]:
    cfg = CONFIG[lang]
    sections = read_sections(pdf)
    start = next(i for i, s in enumerate(sections) if s.level == 2 and s.title == cfg["chapter"])
    end = next(i for i, s in enumerate(sections) if i > start and s.title == cfg["end"])
    words = "|".join(re.escape(w) for w, _ in cfg["rarities"])
    head = re.compile(rf"^(?P<kind>.*?), (?P<rarity>{words})\b(?P<extra>(?: \([^)]*\))?)\s*(?P<rest>.*)$", re.S)
    items = []
    for section in sections[start + 1 : end]:
        # A title that starts in lowercase is a line of the section above it ("dell'acqua").
        if section.level != 4 or not section.body or section.title[:1].islower():
            continue
        m = head.match(section.body[0])
        if not m:
            continue
        rarity = dict(cfg["rarities"])[m["rarity"]]
        kind = plain(m["kind"].lower())
        category = next(
            (c for w, c in sorted(cfg["kinds"].items(), key=lambda kv: -len(kv[0])) if re.match(w + r"\b\b", kind)),
            None,
        )
        first = f'{m["kind"]}, {m["rarity"]}{m["extra"]}'
        text = [m["rest"].strip(), *section.body[1:]]
        items.append(
            {
                "name": section.title,
                "type": first,
                "rarity": rarity,
                "attunement": cfg["attunement"] in m["extra"],
                "category": category,
                "text": [p for p in text if p],
            }
        )
    return items


GLOSSARY_FILES = ["spells", "conditions", "abilities", "skills", "monsters", "classes", "schools", "languages"]


def glossary(lang: str) -> list[tuple[re.Pattern, re.Pattern]]:
    """Pairs of (English name, translated name) of what the rules texts mention, as patterns."""
    pairs = []
    for name in GLOSSARY_FILES:
        english = load_en(name)
        target = load_target(lang, name)
        for k, v in english.items():
            if not k.endswith(".name") or not target.get(k) or len(v) < 4:
                continue
            pairs.append(
                (
                    re.compile(rf"{re.escape(plain(v.lower()))}s?"),
                    re.compile(rf"{re.escape(plain(target[k].lower()))}"),
                )
            )
    return pairs


def stems(text: str) -> set[str]:
    """The words of a text cut to five letters, so inflected forms meet."""
    return {w[:5] for w in re.findall(r"[a-z]{3,}", plain(text.lower()))}


def dictionary(lang: str) -> dict[str, dict[str, float]]:
    """What English stems go with what translated ones, learned from the texts that are already
    translated: a stem goes with another when they keep turning up in the same entries."""
    pairs = collections.Counter()
    seen_en, seen_tr = collections.Counter(), collections.Counter()
    for name in ["spells", "features", "traits", "monsters", "conditions", "classes", "subclasses",
                 "species", "skills", "properties", "backgrounds"]:
        english = load_en(name)
        target = load_target(lang, name)
        for k, v in english.items():
            if k.endswith(".name") or not target.get(k):
                continue
            a, b = stems(v), stems(target[k])
            seen_en.update(a)
            seen_tr.update(b)
            for x in a:
                for y in b:
                    pairs[x, y] += 1
    best: dict[str, dict[str, float]] = {}
    for (x, y), n in pairs.items():
        if n < 3:
            continue
        score = 2 * n / (seen_en[x] + seen_tr[y])
        if score >= 0.25:
            best.setdefault(x, {})[y] = score
    return best


def grams(text: str) -> set[str]:
    t = re.sub(r"[^a-z]", "", plain(text.lower()))
    return {t[i : i + 3] for i in range(len(t) - 2)}


def dice(a: set[str], b: set[str]) -> float:
    return 2 * len(a & b) / ((len(a) + len(b)) or 1)


def compatible(item: dict, m: dict) -> bool:
    """The rarity, the attunement and the kind of item are the same in every language."""
    return (
        item["rarity"] == slugify(m["rarity"]["name"])
        and item["attunement"] == bool(re.search("requires attunement", m["desc"][0], re.I))
        and item["category"] in (None, m["equipment_category"]["index"])
    )


def match(items: list[dict], lang: str = "it") -> tuple[dict, list]:
    pairs = glossary(lang)
    words = dictionary(lang)
    raw = json.loads((ROOT / ".cache/srd51/5e-SRD-Magic-Items.json").read_text(encoding="utf-8"))
    # What the PDF has a section for: every item that is not itself a variant (the ones with
    # variants stand for all of them).
    # The four vessels of the elementals are one section in the PDF, under the ring.
    pool = {
        m["index"]: m
        for m in raw
        if not m["variant"] and not re.search(r"Commanding .* Elementals|Controlling .* Elementals", m["name"])
    }
    slugs = list(pool)

    def body(slug: str) -> str:
        return "\n\n".join(pool[slug]["desc"][1:])

    shown: dict[str, str] = {}

    def mention_score(item: dict, slug: str) -> float:
        """Of the game terms the English text names, how many appear translated in the section."""
        english_text = plain(f'{pool[slug]["name"]} {body(slug)}'.lower())
        text = shown.setdefault(item["name"], plain(" ".join([item["name"], *item["text"]]).lower()))
        wanted = [t for e, t in pairs if e.search(english_text)]
        if not wanted:
            return 0.0
        return sum(1 for t in wanted if t.search(text)) / len(wanted)

    item_stems: dict[str, set[str]] = {}

    def translated_share(item: dict, slug: str) -> float:
        """Of the English stems that have a known translation, how many show up in the section."""
        theirs = item_stems.setdefault(item["name"], stems(" ".join([item["name"], *item["text"]])))
        known = [words[w] for w in stems(f'{pool[slug]["name"]} {body(slug)}') if w in words]
        if not known:
            return 0.0
        return sum(1 for options in known if theirs & options.keys()) / len(known)

    def cost(item: dict, slug: str) -> float:
        m = pool[slug]
        ti = tokens(" ".join(item["text"]))
        te = tokens(body(slug))
        overlap = sum((ti & te).values()) / (sum((ti | te).values()) or 1)
        length_it = sum(len(p) for p in item["text"])
        length_en = len(body(slug)) or 1
        value = -overlap * 100 + abs(length_it / length_en - 1.15) * 40
        value -= dice(grams(item["name"]), grams(m["name"])) * 90
        value -= mention_score(item, slug) * 60
        value -= translated_share(item, slug) * 250
        rarity = slugify(m["rarity"]["name"])
        if item["rarity"] != rarity and rarity != "varies" and item["rarity"] != "varies":
            value += 1000
        if item["attunement"] != bool(re.search("requires attunement", m["desc"][0], re.I)):
            value += 500
        if item["category"] and item["category"] != m["equipment_category"]["index"]:
            value += 300
        return value

    size = max(len(items), len(slugs))
    matrix = [
        [cost(items[r], slugs[c]) if r < len(items) and c < len(slugs) else 500 for c in range(size)]
        for r in range(size)
    ]
    result, doubtful = {}, []
    for r, c in enumerate(hungarian(matrix)):
        if r < len(items) and c < len(slugs):
            # What cannot differ between languages must agree, or the section is left unpaired.
            if matrix[r][c] >= 300 or not compatible(items[r], pool[slugs[c]]):
                doubtful.append((slugs[c], items[r]["name"], round(matrix[r][c], 1)))
                continue
            result[slugs[c]] = items[r]
            if matrix[r][c] > -20:
                doubtful.append((slugs[c], items[r]["name"], round(matrix[r][c], 1)))
    return result, doubtful


def run(lang: str, pdf: Path) -> None:
    items = parse(lang, pdf)
    matched, doubtful = match(items, lang)
    out = load_target(lang, "items")
    english_slugs = {k[: -len(".name")] for k in load_en("items") if k.endswith(".name")}
    written = 0
    for slug, item in matched.items():
        if slug not in english_slugs:
            continue  # an item with variants is not in the data
        written += 1
        out[f"{slug}.name"] = item["name"]
        out[f"{slug}.desc"] = "\n\n".join([item["type"], *item["text"]])
    save_target(lang, "items", out)
    print(f"{len(items)} sections, {written} items written")
    for slug, name, score in sorted(doubtful, key=lambda d: -d[2]):
        print(f"  check: {slug} <- {name} ({score})")


if __name__ == "__main__":
    run(sys.argv[1], Path(sys.argv[2]))
