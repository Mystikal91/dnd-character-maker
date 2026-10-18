"""Imports what the SRD keeps in tables: languages, alignment names, armor, weapons and gear.

    python scripts/srd-translations/import_tables.py it path/to/SRD_CC_v5.1_IT.pdf

The first rows of the language table are paired with English ids through a glossary. Alignment
names are the phrases the stat blocks use ("lawful good"), checked against the PDF. Items follow
in the same file.
"""

import collections
import re
import sys
from pathlib import Path

from import_reference import key, load_en, write
from pdf_tables import Row, read_rows

ROOT = Path(__file__).resolve().parents[2]

LANGUAGE_IDS = {
    "it": {"comune": "common", "nanico": "dwarvish", "elfico": "elvish", "gigante": "giant",
           "gnomesco": "gnomish", "goblin": "goblin", "halfling": "halfling", "orchesco": "orc",
           "abissale": "abyssal", "celestiale": "celestial", "draconico": "draconic",
           "gergo delle profondita": "deep-speech", "infernale": "infernal",
           "primordiale": "primordial", "silvano": "sylvan", "sottocomune": "undercommon"},
    "fr": {"commun": "common", "nain": "dwarvish", "elfique": "elvish", "gigant": "giant",
           "gnome": "gnomish", "gobelin": "goblin", "halfelin": "halfling", "orc": "orc",
           "abyssal": "abyssal", "celeste": "celestial", "draconique": "draconic",
           "profond": "deep-speech", "infernal": "infernal", "primordial": "primordial",
           "sylvestre": "sylvan", "commun des profondeurs": "undercommon"},
    "de": {"gemeinsprache": "common", "zwergisch": "dwarvish", "elfisch": "elvish",
           "riesisch": "giant", "gnomisch": "gnomish", "goblinisch": "goblin",
           "halblingisch": "halfling", "orkisch": "orc", "abyssisch": "abyssal",
           "celestisch": "celestial", "drakonisch": "draconic", "tiefensprache": "deep-speech",
           "infernalisch": "infernal", "urtuemlich": "primordial", "sylvanisch": "sylvan",
           "gemeinsprache der unterreiche": "undercommon"},
    "es": {"comun": "common", "enano": "dwarvish", "elfo": "elvish", "gigante": "giant",
           "gnomo": "gnomish", "goblin": "goblin", "mediano": "halfling", "orco": "orc",
           "abisal": "abyssal", "celestial": "celestial", "draconico": "draconic",
           "habla de las profundidades": "deep-speech", "infernal": "infernal",
           "primordial": "primordial", "silvano": "sylvan", "infracomun": "undercommon"},
}

# Words of an alignment phrase: (lawful, neutral, chaotic) and (good, neutral, evil).
ALIGNMENT_WORDS = {
    "it": (("legale", "neutrale", "caotico"), ("buono", "neutrale", "malvagio")),
    "fr": (("loyal", "neutre", "chaotique"), ("bon", "neutre", "mauvais")),
    "de": (("rechtschaffen", "neutral", "chaotisch"), ("gut", "neutral", "boese")),
    "es": (("legal", "neutral", "caotico"), ("bueno", "neutral", "malvado")),
}
ALIGNMENT_IDS = [
    ("lawful-good", 0, 0), ("neutral-good", 1, 0), ("chaotic-good", 2, 0),
    ("lawful-neutral", 0, 1), ("neutral", 1, 1), ("chaotic-neutral", 2, 1),
    ("lawful-evil", 0, 2), ("neutral-evil", 1, 2), ("chaotic-evil", 2, 2),
]


def out_done(out: list) -> bool:
    """The language table has 16 rows in two parts; stop once they are all read."""
    return len(out) >= 16


def language_rows(rows: list[Row], lang: str) -> list[tuple[str, str, str]]:
    """(name, speakers, script) for each language table row; wrapped cells are joined."""
    out: list[list[str]] = []
    columns: list[float] = []
    active = False
    for i, row in enumerate(rows):
        if row.kind == "header":
            following = rows[i + 1].texts[0] if i + 1 < len(rows) and rows[i + 1].cells else ""
            if len(row.cells) == 3 and not out_done(out) and key(following) in LANGUAGE_IDS[lang]:
                columns = [x for x, _ in row.cells]
                active = True
            else:
                active = False  # another table starts: the languages are over
            continue
        if not active or row.kind != "row" or len(row.cells) > 3:
            continue
        cells = ["", "", ""]
        for x, text in row.cells:
            cells[min(range(3), key=lambda i: abs(columns[i] - x))] = text
        if cells[1] and cells[2] or not out:
            out.append(cells)
        else:  # a wrapped continuation of the previous row
            for i in range(3):
                if cells[i]:
                    out[-1][i] = f"{out[-1][i]} {cells[i]}".strip()
    return [tuple(c) for c in out]  # type: ignore[misc]


def import_languages(lang: str, pdf: Path) -> None:
    from pdf_sections import read_sections

    secs = read_sections(pdf)
    # The table sits in the chapter of the first class's predecessor: find its pages by header.
    rows = read_rows(pdf, 50, 80)
    table = language_rows(rows, lang)
    english = load_en("languages")
    values: dict[str, str] = {}
    unknown = []
    for name, speakers, script in table:
        slug = LANGUAGE_IDS[lang].get(key(name))
        if not slug:
            unknown.append(name)
            continue
        values[f"{slug}.name"] = name
        values[f"{slug}.speakers"] = speakers
        if script and script not in "—−-":
            values[f"{slug}.script"] = script
    print(lang, "languages", write(lang, "languages", values), "of", len(english), "unknown:", unknown)


def import_alignment_names(lang: str, pdf: Path) -> None:
    import pymupdf

    seen = collections.Counter()
    for page in pymupdf.open(pdf):
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [s for s in line["spans"] if s["text"].strip()]
                if spans and spans[0]["font"] == "Calibri-Italic" and round(spans[0]["size"]) == 10:
                    text = "".join(s["text"] for s in spans).strip()
                    if "," in text:
                        seen[text.rsplit(",", 1)[1].strip()] += 1
    ethic, moral = ALIGNMENT_WORDS[lang]
    values = {}
    for slug, e, m in ALIGNMENT_IDS:
        phrase = ethic[e] if e == m == 1 else f"{ethic[e]} {moral[m]}"
        # "chaotique mauvais" is written in the PDF as is; accent-free comparison.
        hit = next((p for p in seen if key(p) == phrase), None)
        if hit:
            values[f"{slug}.name"] = " ".join(w.capitalize() for w in hit.split())
    print(lang, "alignment names", len(values), "of 9")
    existing = ROOT / "locales" / lang / "srd51" / "alignments.json"
    import json

    current = json.loads(existing.read_text(encoding="utf-8")) if existing.exists() else {}
    merged = {**current, **values}
    order = load_en("alignments")
    existing.write_text(
        json.dumps({k: merged[k] for k in order if k in merged}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


COST = re.compile(r"^([\d.,  ]+)\s*([A-Za-z]{2})$")
WEIGHT = re.compile(r"^([\d.,]+)\s*(kg|g)$", re.IGNORECASE)
DICE = re.compile(r"^(\d+)[dDwW](\d+)")


def number(text: str) -> float:
    """Reads 1.500 / 1 500 / 1,500 / 0,125 style numbers: separators of thousands are dropped."""
    t = text.replace(" ", " ").replace(" ", "").strip()
    if re.fullmatch(r"\d{1,3}([.,]\d{3})+", t):
        return float(re.sub(r"[.,]", "", t))
    return float(t.replace(",", "."))


def coin_symbols(rows: list[Row]) -> list[str]:
    """The five coin abbreviations in the order cp, sp, ep, gp, pp, from the coin table header."""
    for row in rows:
        texts = row.texts
        if row.kind == "header" and len(texts) == 6 and all(len(t) <= 3 and t.isupper() for t in texts[1:]):
            return [t.lower() for t in texts[1:]]
    raise LookupError("coin table not found")


def table_items(rows: list[Row], coins: list[str]) -> list[dict]:
    """Every row that looks like an item: name, cost, weight in pounds and damage dice."""
    units = dict(zip(coins, ["cp", "sp", "ep", "gp", "pp"]))
    found: list[dict] = []
    for row in rows:
        if row.kind != "row":
            continue
        cells = row.cells
        # Gear tables put two items on one row: split the cells into groups of three.
        double = len(cells) == 6 and COST.match(cells[4][1]) is not None
        chunks = [cells[:3], cells[3:]] if double else [cells]
        for chunk in chunks:
            texts = [t for _, t in chunk]
            cost = COST.match(texts[1]) if len(texts) > 1 else None
            if not cost or cost.group(2).lower() not in units:
                continue
            weight = None
            w = next((m for m in (WEIGHT.match(t) for t in texts[2:]) if m), None)
            if w:
                weight = number(w.group(1)) * (0.001 if w.group(2).lower() == "g" else 1) * 2
            dice = next((f"{m.group(1)}d{m.group(2)}" for m in (DICE.match(t) for t in texts[2:]) if m), None)
            found.append({
                "name": texts[0], "unit": units[cost.group(2).lower()], "amount": number(cost.group(1)),
                "weight": weight, "dice": dice, "cells": len(texts), "page": row.page, "y": row.y,
                "x": chunk[0][0],
            })
    return found


def join_wrapped_names(rows: list[Row], items: list[dict]) -> None:
    """A name that wraps onto a second line: a lone cell right under an item, same x."""
    by_page: dict[int, list[Row]] = collections.defaultdict(list)
    for r in rows:
        by_page[r.page].append(r)
    for item in items:
        for r in by_page[item["page"]]:
            if len(r.cells) == 1 and 0 < r.y - item["y"] < 14 and abs(r.cells[0][0] - item["x"]) < 4:
                text = r.cells[0][1]
                if not re.search(r"\d\s*(mo|ma|mr|me|mp)", text) and text[:1].islower() or text.startswith("("):
                    item["name"] = f"{item['name']} {text}"


def import_items(lang: str, pdf: Path) -> None:
    import json

    rows = read_rows(pdf, 55, 90)
    coins = coin_symbols(rows)
    start = next(i for i, r in enumerate(rows) if r.kind == "header" and len(r.texts) == 6 and r.texts[1:] and all(len(t) <= 3 for t in r.texts[1:]))
    table = table_items(rows[start:], coins)
    join_wrapped_names(rows[start:], table)

    entries = json.loads((ROOT / "data/srd51/items.json").read_text(encoding="utf-8"))["entries"]
    english = load_en("items")
    items = []
    for e in entries:
        d = e["data"]
        weapon = d.get("weapon", {}).get("damage") or {}
        items.append({
            "slug": e["id"].split("/")[1], "unit": d["cost"]["unit"], "amount": float(d["cost"]["amount"]),
            "weight": d.get("weight"), "dice": weapon.get("dice"), "category": d["category"],
        })
    values: dict[str, str] = {}

    # Armor comes in the English order, so it pairs by position: the six-column rows.
    armor_rows = [t for t in table if t["cells"] == 6]
    armor_items = [i for i in items if i["category"] == "armor"]
    if len(armor_rows) == len(armor_items):
        for item, row in zip(armor_items, armor_rows):
            values[f"{item['slug']}.name"] = row["name"]
    else:
        print(lang, "armor rows", len(armor_rows), "of", len(armor_items), "- skipped")

    # Everything else pairs by cost, weight and damage dice; only unique pairs are kept.
    def signature(unit, amount, weight, dice):
        return (unit, amount, None if weight is None else round(weight, 1), dice)

    others = [t for t in table if t["cells"] != 6]
    en_count = collections.Counter(signature(i["unit"], i["amount"], i["weight"], i["dice"]) for i in items if i["category"] != "armor")
    pdf_count = collections.Counter(signature(t["unit"], t["amount"], t["weight"], t["dice"]) for t in others)
    en_by_sig = {signature(i["unit"], i["amount"], i["weight"], i["dice"]): i for i in items if i["category"] != "armor"}
    paired = 0
    for t in others:
        sig = signature(t["unit"], t["amount"], t["weight"], t["dice"])
        if en_count.get(sig) == 1 and pdf_count.get(sig) == 1:
            slug = en_by_sig[sig]["slug"]
            values.setdefault(f"{slug}.name", t["name"])
            paired += 1
    print(lang, "items", write(lang, "items", values), "of", len([k for k in english if k.endswith(".name")]), "(unique matches:", paired, ")")


BACKGROUND_TITLES = {
    "it": ("tratti caratteriali", "ideale", "legame", "difetto"),
    "fr": ("traits de personnalite", "ideal", "obligation", "faille"),
    "de": ("persoenlichkeitsmerkmal", "ideal", "bindung", "makel"),
    "es": ("rasgo de personalidad", "ideal", "vinculo", "defecto"),
}


def import_background_tables(lang: str, pdf: Path) -> None:
    """Personality traits, ideals, bonds and flaws of the background: four d8/d6 tables.

    They come in this order in every language. Cells are read per column of the page, since
    two tables can sit side by side.
    """
    import json

    import pymupdf

    tables: list[dict] = []
    doc = pymupdf.open(pdf)
    current: dict[int, dict | None] = {0: None, 1: None}
    for pno in range(54, 80):
        page = doc[pno]
        width = page.rect.width
        lines = []
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [sp for sp in line["spans"] if sp["text"].strip()]
                if spans and spans[0]["font"].startswith("Calibri") and round(spans[0]["size"]) == 9:
                    lines.append((int(line["bbox"][0] > width / 2 - 5), line["bbox"][1], "".join(sp["text"] for sp in spans).strip(), spans[0]["font"]))
        lines.sort(key=lambda item: (item[0], item[1]))  # left column first, top to bottom
        lines = [(c, t, f) for c, _, t, f in lines]
        for i, (col, text, font) in enumerate(lines):
            if re.fullmatch(r"[dDwW][68]", text) and font.endswith("Bold"):
                title = lines[i + 1][1] if i + 1 < len(lines) else ""
                prev = tables[-1] if tables else None
                if prev is not None and prev["title"] == title and prev["die"] == text:
                    current[col] = prev  # the same table, continued on the next page or column
                else:
                    current[col] = {"die": text, "title": title, "entries": []}
                    tables.append(current[col])
                continue
            table = current[col]
            if table is None or text == table["title"] or font.endswith("Bold"):
                continue
            if re.fullmatch(r"\d", text):
                table["entries"].append([])
            elif table["entries"]:
                table["entries"][-1].append(text)
        # Stop once the four tables are complete: later pages have other tables in the same font.
        done = [
            next((t for t in tables if key(t["title"]) == title), None)
            for title in BACKGROUND_TITLES[lang]
        ]
        if all(t is not None for t in done) and [len(t["entries"]) for t in done] == [8, 6, 6, 6]:
            break
    # Tables are named by their title, in the language's own words.
    by_field = {}
    for field, title in zip(("personalityTraits", "ideals", "bonds", "flaws"), BACKGROUND_TITLES[lang]):
        found = [t for t in tables if key(t["title"]) == title]
        by_field[field] = found[0] if found else None
    sizes = {f: (len(t["entries"]) if t else 0) for f, t in by_field.items()}
    if sizes != {"personalityTraits": 8, "ideals": 6, "bonds": 6, "flaws": 6}:
        print(lang, "background tables not read:", sizes)
        return

    def join(lines: list[str]) -> str:
        out = lines[0]
        for nxt in lines[1:]:
            out = out[:-1] + nxt if lang == "de" and out.endswith("-") and nxt[:1].islower() else f"{out} {nxt}"
        return re.sub(r"\s+", " ", out).strip()

    values: dict[str, str] = {}
    for field, table in by_field.items():
        for n, lines in enumerate(table["entries"], start=1):
            text = join(lines)
            if field == "ideals":
                text = re.sub(r"\s*\([^)]*\)\.?$", "", text)  # the alignment of the ideal
            values[f"acolyte.{field}.{n}"] = text
    path = ROOT / "locales" / lang / "srd51" / "backgrounds.json"
    current_values = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    merged = {**current_values, **values}
    order = load_en("backgrounds")
    path.write_text(
        json.dumps({k: merged[k] for k in order if k in merged}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(lang, "background tables", len(values))


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    language, pdf_path = sys.argv[1], Path(sys.argv[2])
    import_languages(language, pdf_path)
    import_alignment_names(language, pdf_path)
    import_items(language, pdf_path)
    import_background_tables(language, pdf_path)
