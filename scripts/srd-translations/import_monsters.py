"""Imports the monster texts from an official SRD 5.1 translation.

    python scripts/srd-translations/import_monsters.py it path/to/SRD_CC_v5.1_IT.pdf
    python scripts/srd-translations/import_monsters.py it path/to/SRD_CC_v5.1_IT.pdf --show goblin

Stat blocks are set in Calibri: a bold 12 pt name, an italic line with size, type and alignment,
bold labels for the facts (armor class, hit points...), and run-in bold italic names for traits and
actions. The labels differ per language, so a block is read by position and shape, and paired with
its English monster by a numeric signature: armor class, hit points, XP and the six ability
scores. Blocks that share a signature (a monster and its twin) are told apart by the numbers of
their text. Inside a block, traits and actions are paired by order, and a block whose structure
does not agree with the English one keeps its English texts for the parts that disagree.
"""

import json
import math
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from import_options import save_target
from import_reference import ROOT, key, load_en
from import_spells import hungarian
from pdf_sections import NOISE

SECTION_KEYS = ["special", "actions", "reactions", "legendary"]
SCORE = re.compile(r"(\d+)\s*\(\s*[+\-−–]?\s*\d+\s*\)")
XP = re.compile(r"\(\s*([\d.,\s  ]+?)\s*[A-Za-z]{2}\s*\)")
# Lines of one paragraph overlap a little; a gap above this starts a new paragraph.
PARAGRAPH_GAP = 1.5
# How much better than its next best partner an entry must pair, or it stays English.
MARGIN = 0.12


@dataclass
class Line:
    spans: list[tuple[str, float, str]]  # font, size, text
    top: float
    bottom: float
    page: int

    @property
    def font(self) -> str:
        return self.spans[0][0]

    @property
    def size(self) -> int:
        return round(self.spans[0][1])

    @property
    def text(self) -> str:
        return "".join(s[2] for s in self.spans).strip()

    def split(self, wanted: str) -> tuple[str, str]:
        """The leading text set in a font that has `wanted` in its name, and the rest."""
        lead, rest, leading = [], [], True
        for font, _, text in self.spans:
            if leading and (wanted in font or not text.strip()):
                lead.append(text)
            else:
                leading = False
                rest.append(text)
        return "".join(lead).strip(), "".join(rest).strip()


def read_lines(pdf: Path) -> list[Line]:
    import pymupdf

    lines: list[Line] = []
    for pno, page in enumerate(pymupdf.open(pdf), start=1):
        for block in page.get_text("dict")["blocks"]:
            for raw in block.get("lines", []):
                spans = [(s["font"], s["size"], s["text"]) for s in raw["spans"] if s["text"]]
                if not any(t.strip() for _, _, t in spans):
                    continue
                while not spans[0][2].strip():
                    spans.pop(0)
                line = Line(spans, raw["bbox"][1], raw["bbox"][3], pno)
                if NOISE.match(line.text):
                    continue
                lines.append(line)
    return lines


def is_name(l: Line) -> bool:
    return l.font == "Calibri-Bold" and l.size == 12


def is_type(l: Line) -> bool:
    return l.font.startswith("Calibri") and "Italic" in l.font and "Bold" not in l.font


def is_label(l: Line) -> bool:
    return l.font == "Calibri-Bold" and l.size == 10


def is_heading(l: Line) -> bool:
    return l.font == "Calibri-Bold" and l.size == 11


def is_entry(l: Line) -> bool:
    return l.font.startswith("Calibri") and "BoldIt" in l.font


@dataclass
class Entry:
    name: str
    lines: list[Line]
    first: str = ""  # what follows the name on its first line


@dataclass
class Block:
    name: str
    type_line: str
    facts: list[str] = field(default_factory=list)  # one value per bold label, in order
    scores: list[int] = field(default_factory=list)
    sections: list[list[Entry]] = field(default_factory=list)  # traits, then one per heading
    text: str = ""


def start_of_block(lines: list[Line], i: int):
    """(index after the name, index after the type line) when a stat block starts at `i`."""
    n = len(lines)
    if not is_name(lines[i]):
        return None
    j = i
    while j < n and is_name(lines[j]):
        j += 1
    k = j
    while k < n and is_type(lines[k]):
        k += 1
    if k > j and k < n and is_label(lines[k]):
        return j, k
    return None


def join_text(parts: list[str], dehyphenate: bool) -> str:
    joined = parts[0]
    for nxt in parts[1:]:
        if dehyphenate and joined.endswith("-") and joined[-2:-1].isalpha() and nxt[:1].islower():
            joined = joined[:-1] + nxt
        else:
            joined = f"{joined} {nxt}"
    return re.sub(r"\s+", " ", joined).strip()


def paragraphs(first: str, lines: list[Line], dehyphenate: bool) -> list[str]:
    """The text of an entry as paragraphs; `first` is what follows the name on its first line."""
    out: list[list[str]] = []
    prev = None
    for text, top, bottom in [(first, None, None)] + [(l.text, l.top, l.bottom) for l in lines]:
        if not text:
            prev = bottom if bottom is not None else prev
            continue
        if not out or (top is not None and prev is not None and top - prev > PARAGRAPH_GAP):
            out.append([])
        out[-1].append(text)
        prev = bottom if bottom is not None else prev
    return [join_text(p, dehyphenate) for p in out]


def parse_block(lines: list[Line], i: int, j: int, k: int, end: int, dehyphenate: bool) -> Block:
    name = join_text([l.text for l in lines[i:j]], dehyphenate)
    type_line = join_text([l.text for l in lines[j:k]], dehyphenate)
    block = Block(name, type_line)
    facts: list[list[str]] = []
    idx = k
    while idx < end and not (is_entry(lines[idx]) or is_heading(lines[idx])):
        line = lines[idx]
        # The challenge line ends the facts; a bold name after it begins a trait.
        if facts and XP.search(" ".join(facts[-1])) and is_label(line):
            break
        if is_label(line):
            facts.append([line.split("Bold")[1]] if line.split("Bold")[1] else [])
        elif facts:
            facts[-1].append(line.text)
        idx += 1
    values = [join_text(f, dehyphenate) if f else "" for f in facts]
    # The six ability labels, then one line with the six scores that lands on the last label.
    for pos, value in enumerate(values):
        found = SCORE.findall(value)
        if len(found) >= 6:
            block.scores = [int(x) for x in found[:6]]
            values = values[: pos - 5] + values[pos + 1 :]
            break
    block.facts = values

    block.sections = [[]]
    # Past the facts, a run-in name begins an entry: bold italic for traits and actions, plain
    # bold for the legendary ones. A section that has the first kind keeps the second inside
    # the text (the options of a breath weapon).
    styles: list[str | None] = [None]

    def begins(l: Line) -> bool:
        return is_entry(l) or (is_label(l) and styles[-1] != "italic")

    while idx < end:
        line = lines[idx]
        if is_heading(line):
            block.sections.append([])
            styles.append(None)
        elif begins(line):
            styles[-1] = "italic" if is_entry(line) else "bold"
            name_part, rest = line.split("Bold")
            body = [rest] if rest else []
            entry_lines: list[Line] = []
            idx += 1
            # A long name wraps onto a second bold line.
            # German ends the name with a colon, the others with a full stop.
            while idx < end and begins(lines[idx]) and not name_part.rstrip().endswith((".", ":")):
                more, rest2 = lines[idx].split("Bold")
                name_part = f"{name_part} {more}"
                if rest2:
                    body.append(rest2)
                idx += 1
            while idx < end and not (begins(lines[idx]) or is_heading(lines[idx])):
                entry_lines.append(lines[idx])
                idx += 1
            entry = Entry(name_part.strip().rstrip(".:").strip(), entry_lines, " ".join(body))
            block.sections[-1].append(entry)
            continue
        idx += 1
    block.text = " ".join(l.text for l in lines[i:end])
    return block


def read_blocks(pdf: Path, dehyphenate: bool) -> list[Block]:
    lines = read_lines(pdf)
    blocks = []
    i = 0
    while i < len(lines):
        start = start_of_block(lines, i)
        if not start:
            i += 1
            continue
        j, k = start
        end = k
        while end < len(lines):
            if start_of_block(lines, end) and end > k:
                break
            if lines[end].font.startswith("Cambria") or (lines[end].font == "Calibri" and lines[end].size >= 12):
                break
            end += 1
        blocks.append(parse_block(lines, i, j, k, end, dehyphenate))
        i = end
    return blocks


# --- the English side -------------------------------------------------------------------------


def english_monsters() -> dict:
    data = json.loads((ROOT / "data/srd51/monsters.json").read_text(encoding="utf-8"))["entries"]
    strings = load_en("monsters")
    out = {}
    for e in data:
        slug = e["id"].split("/")[1]
        d = e["data"]
        a = d["abilities"]
        out[slug] = {
            "sig": (
                d["armorClass"][0]["value"],
                d["hitPoints"],
                d["xp"],
                (a["str"], a["dex"], a["con"], a["int"], a["wis"], a["cha"]),
            ),
            "data": d,
            "strings": {k: v for k, v in strings.items() if k.startswith(f"{slug}.")},
        }
    return out


# Damage types are not in the translated files, so their words are here: a translated text that
# says "fuoco" is about the same thing as an English one that says "fire".
DAMAGE_WORDS = {
    "it": ["acido", "contundent", "freddo", "fuoco", "forza", "fulmin", "necrotic", "perforant", "veleno",
           "psichic", "radios", "tagliant", "tuono"],
    "fr": ["acide", "contondant", "froid", "feu", "force", "foudre", "necrotique", "perforant", "poison",
           "psychique", "radiant", "tranchant", "tonnerre"],
    "de": ["saure", "wucht", "kalte", "feuer", "energie", "blitz", "nekrotisch", "stich", "gift",
           "psychisch", "gleiss", "hieb", "donner"],
    "es": ["acido", "contundente", "frio", "fuego", "fuerza", "relampago", "necrotico", "perforante",
           "veneno", "psiquico", "radiante", "cortante", "trueno"],
}
DAMAGE_EN = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison",
             "psychic", "radiant", "slashing", "thunder"]
# (English word, stem of its translation), filled by `load_terms`.
TERMS: list[tuple[re.Pattern, str]] = []


def load_terms(lang: str) -> None:
    """Pairs of an English game word and the stem of its translation, for the names the
    translated files already have (abilities, skills, conditions) and for damage types."""
    TERMS.clear()
    for name in ("abilities", "skills", "conditions"):
        english = load_en(name)
        path = ROOT / "locales" / lang / "srd51" / f"{name}.json"
        translated = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        for k, word in english.items():
            if k.endswith(".name") and translated.get(k):
                TERMS.append((re.compile(rf"\b{re.escape(word.lower())}", re.I), key(translated[k])[:5]))
    for word, stem in zip(DAMAGE_EN, DAMAGE_WORDS[lang]):
        TERMS.append((re.compile(rf"\b{word}", re.I), key(stem)[:5]))


def profile(text: str, english: bool) -> Counter:
    """The numbers of a text and the game words it uses, in a form that both languages share."""
    found = Counter(re.findall(r"\d+", text))
    plain_text = key(text)
    for pattern, stem in TERMS:
        if (pattern.search(text) if english else re.search(rf"\b{re.escape(stem)}", plain_text)):
            found[f"K:{stem}"] += 1
    return found


def similarity(a: Counter, b: Counter) -> float:
    total = max(sum(a.values()), sum(b.values()), 1)
    return sum((a & b).values()) / total


def first_int(text: str):
    m = re.search(r"\d[\d.,]*", text)
    return int(re.sub(r"\D", "", m.group())) if m else None


def block_signature(b: Block):
    if len(b.scores) != 6 or len(b.facts) < 4:
        return None
    xp = XP.findall(b.facts[-1])
    return (
        first_int(b.facts[0]),
        first_int(b.facts[1]),
        int(re.sub(r"\D", "", xp[-1])) if xp else None,
        tuple(b.scores),
    )


# The SRD prints one block where the database has several (the forms of a werewolf, the swarms of
# insects). The block names the entry listed here; the others share its texts but keep their names.
PRIMARY = {"swarm-of-insects"}

# What identifies a monster when the exact signature finds none: the database and the book
# disagree on a few armor classes, hit points and experience values.
FALLBACKS = [
    lambda sig: (sig[1], sig[2], sig[3]),
    lambda sig: (sig[0], sig[1], sig[3]),
    lambda sig: (sig[0], sig[1], sig[2]),
    lambda sig: (sig[0], sig[2], sig[3]),
    lambda sig: (sig[2], sig[3]),
]


def pair_blocks(blocks: list[Block], english: dict):
    """(slug, block, shared) for every English monster a block can be found for."""
    by_sig: dict = {}
    for slug, e in english.items():
        by_sig.setdefault(e["sig"], []).append(slug)
    pdf_by_sig: dict = {}
    for b in blocks:
        sig = block_signature(b)
        if sig:
            pdf_by_sig.setdefault(sig, []).append(b)

    def text_numbers(slug: str) -> Counter:
        return profile(" ".join(english[slug]["strings"].values()), True)

    pairs: list[tuple[str, Block, bool]] = []
    for sig, slugs in by_sig.items():
        found = pdf_by_sig.get(sig, [])
        if not found:
            continue
        slugs = sorted(slugs, key=lambda s: s not in PRIMARY)
        size = max(len(slugs), len(found))
        cost = [[1.0] * size for _ in range(size)]
        for r, slug in enumerate(slugs):
            for c, block in enumerate(found):
                cost[r][c] = 1.0 - similarity(text_numbers(slug), profile(block.text, False))
                if slug in PRIMARY:
                    cost[r][c] -= 0.5
        for r, c in enumerate(hungarian(cost)):
            if r < len(slugs) and c < len(found):
                pairs.append((slugs[r], found[c], False))

    paired = {slug for slug, _, _ in pairs}
    for fallback in FALLBACKS:
        index: dict = {}
        for b in blocks:
            sig = block_signature(b)
            if sig:
                index.setdefault(fallback(sig), []).append(b)
        for slug, e in english.items():
            if slug in paired:
                continue
            candidates = index.get(fallback(e["sig"]), [])
            if not candidates:
                continue
            best = max(candidates, key=lambda b: similarity(text_numbers(slug), profile(b.text, False)))
            # Used already by an exact match: the block is shared and gives no name.
            taken = any(b is best and not shared for _, b, shared in pairs)
            pairs.append((slug, best, taken))
            paired.add(slug)
    return pairs


# --- writing the texts ------------------------------------------------------------------------

USAGE_NAME = re.compile(r"\s*\([^)]*\)\s*$")


def clean_name(name: str) -> str:
    return USAGE_NAME.sub("", name).strip().lower()


def alignment_of(type_line: str) -> str:
    depth = 0
    for pos, ch in enumerate(type_line):
        depth += (ch == "(") - (ch == ")")
        if ch == "," and depth == 0:
            return type_line[pos + 1 :].strip()
    return ""


def fill(
    slug: str,
    block: Block,
    english: dict,
    out: dict,
    dehyphenate: bool,
    report: Counter,
    glossary: dict[str, str],
    shared: bool = False,
    problems: list[str] | None = None,
):
    problems = problems if problems is not None else []
    e = english[slug]
    strings, data = e["strings"], e["data"]
    if not shared:
        out[f"{slug}.name"] = block.name
    if f"{slug}.alignment" in strings and alignment_of(block.type_line):
        out[f"{slug}.alignment"] = alignment_of(block.type_line)

    roles = []
    if data.get("saves"):
        roles.append("saves")
    if data.get("skills"):
        roles.append("skills")
    for field_name in ("vulnerabilities", "resistances", "immunities"):
        if f"{slug}.{field_name}" in strings:
            roles.append(field_name)
    if data.get("conditionImmunities"):
        roles.append("conditionImmunities")
    roles += ["senses", "languages", "challenge"]
    rest = block.facts[3:]
    if len(rest) == len(roles):
        facts = dict(zip(roles, rest))
    else:
        report["facts differ"] += 1
        facts = {"languages": rest[-2]} if len(rest) >= 2 else {}
    for field_name in ("vulnerabilities", "resistances", "immunities"):
        if facts.get(field_name):
            out[f"{slug}.{field_name}"] = facts[field_name]
    if facts.get("languages") and facts["languages"] not in ("—", "-", "–") and strings.get(f"{slug}.languages"):
        out[f"{slug}.languages"] = facts["languages"]

    present = [k for k in SECTION_KEYS[1:] if data.get(k)]
    pdf_sections = [s for s in block.sections[1:]]
    sections = {"special": block.sections[0]}
    if len(pdf_sections) == len(present):
        sections.update(dict(zip(present, pdf_sections)))
    else:
        report["sections differ"] += 1
    for key_name, entries in sections.items():
        count = len(data.get(key_name) or [])
        if len(entries) != count:
            report[f"{key_name} count differs"] += 1
            problems.append(f"{slug}.{key_name} {len(entries)} in the PDF, {count} in English")
        if not entries or not count:
            continue
        texts = [paragraphs(entry.first, entry.lines, dehyphenate) for entry in entries]
        wanted = [
            entry_numbers(strings, data[key_name][n], f"{slug}.{key_name}.{n + 1}")
            for n in range(count)
        ]
        found = [profile(f"{entry.name} {' '.join(p)}", False) for entry, p in zip(entries, texts)]
        lengths = [(len(strings.get(f"{slug}.{key_name}.{n + 1}.desc", "")),) for n in range(count)]
        sizes = [len(" ".join(p)) for p in texts]
        first = key_name == "actions" and "multiattack" in data["actions"][0]
        # An entry that other monsters already showed under this name is the likely partner.
        known = [
            glossary.get(clean_name(strings.get(f"{slug}.{key_name}.{n + 1}.name", "")))
            for n in range(count)
        ]
        bonus = [[-0.5 if known[r] and known[r] == clean_name(e.name) else 0.0 for e in entries] for r in range(count)]
        for n, c in pair_entries(wanted, found, [x[0] for x in lengths], sizes, first, bonus):
            prefix = f"{slug}.{key_name}.{n + 1}"
            entry, paras = entries[c], texts[c]
            english_name = strings.get(f"{prefix}.name", "")
            out[f"{prefix}.name"] = (
                entry.name if "(" in english_name else USAGE_NAME.sub("", entry.name)
            )
            template = re.findall(r"\n+", strings.get(f"{prefix}.desc", ""))
            if paras and len(template) == len(paras) - 1:
                out[f"{prefix}.desc"] = paras[0] + "".join(
                    sep + p for sep, p in zip(template, paras[1:])
                )
            else:
                out[f"{prefix}.desc"] = "\n\n".join(paras)
        report[f"{key_name} entries"] += count
    report["monsters"] += 1


def entry_numbers(strings: dict, entry_data: dict, prefix: str) -> Counter:
    """The numbers of an English entry: its name and text, and how often it can be used."""
    usage = entry_data.get("usage") or {}
    extra = [str(usage[k]) for k in ("times", "minValue") if k in usage]
    if "minValue" in usage:
        extra.append("6")
    return profile(
        f"{strings.get(f'{prefix}.name', '')} {strings.get(f'{prefix}.desc', '')} {' '.join(extra)}",
        True,
    )


def pair_entries(
    wanted: list[Counter],
    found: list[Counter],
    en_len: list[int],
    pdf_len: list[int],
    en_first: bool = False,
    bonus: list[list[float]] | None = None,
):
    """(English index, PDF index) pairs; the translations sort their entries, so the order says
    nothing. The numbers and the length of the text decide, and a pair that another could
    replace almost as well is left out, to stay English rather than carry the wrong text."""
    rows, cols = len(wanted), len(found)
    if rows == 0 or cols == 0:
        return []
    if rows == 1 and cols == 1:
        return [(0, 0)]
    size = max(rows, cols)
    # Rows or columns that have no partner cost the same with everything.
    cost = [[1.0] * size for _ in range(size)]
    for r in range(rows):
        for c in range(cols):
            cost[r][c] = (
                (1.0 - similarity(wanted[r], found[c]))
                + 0.25 * min(abs(math.log(max(pdf_len[c], 1) / max(en_len[r] * 1.15, 1))), 2.0)
                # A multiattack stays first in every translation, whatever the sorting does.
                + (0.5 if en_first and (r == 0) != (c == 0) else 0.0)
                + (bonus[r][c] if bonus else 0.0)
            )
    pairs = []
    for r, c in enumerate(hungarian(cost)):
        if r >= rows or c >= cols:
            continue
        row_alt = min(cost[r][x] for x in range(size) if x != c)
        col_alt = min(cost[x][c] for x in range(size) if x != r)
        if min(row_alt, col_alt) - cost[r][c] >= MARGIN:
            pairs.append((r, c))
    return pairs


def english_name_of(english: dict, key_: str) -> str:
    return english[key_.split(".")[0]]["strings"].get(key_, "")


def run(lang: str, pdf: Path, show: str | None = None) -> None:
    dehyphenate = lang == "de"
    load_terms(lang)
    blocks = read_blocks(pdf, dehyphenate)
    english = english_monsters()
    pairs = pair_blocks(blocks, english)
    glossary: dict[str, str] = {}
    for _ in range(2):
        problems: list[str] = []
        out: dict[str, str] = {}
        report: Counter = Counter()
        for slug, block, shared in pairs:
            if show == slug and not glossary:
                print(json.dumps({"name": block.name, "type": block.type_line, "facts": block.facts,
                                  "scores": block.scores,
                                  "sections": [[(e.name, paragraphs(e.first, e.lines, dehyphenate)) for e in s]
                                               for s in block.sections]}, ensure_ascii=False, indent=1))
            fill(slug, block, english, out, dehyphenate, report, glossary, shared, problems)
        # What the names of the entries came out as, to settle the entries the numbers cannot.
        seen: dict[str, Counter] = {}
        for k, v in out.items():
            if re.search(r"\.(special|actions|reactions|legendary)\.\d+\.name$", k):
                seen.setdefault(clean_name(english_name_of(english, k)), Counter())[clean_name(v)] += 1
        glossary = {en: names.most_common(1)[0][0] for en, names in seen.items()
                    if names.most_common(1)[0][1] >= 2 or len(names) == 1}
    save_target(lang, "monsters", out)
    missing = sorted(set(english) - {s for s, _, _ in pairs})
    print(lang, "blocks read", len(blocks), "paired", len(pairs), "of", len(english), "English;",
          len(out), "texts;", dict(report))
    if problems:
        print("  structure differs:", "; ".join(problems[:30]))
    print("  without a block:", ", ".join(missing[:40]), "..." if len(missing) > 40 else "")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    show_slug = sys.argv[sys.argv.index("--show") + 1] if "--show" in sys.argv else None
    if show_slug in args:
        args.remove(show_slug)
    run(args[0], Path(args[1]), show_slug)
