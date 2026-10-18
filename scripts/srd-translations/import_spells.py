"""Imports the spell texts of an official SRD 5.1 translation into `locales/<lang>/srd51/spells.json`.

The translated PDFs list spells in the translated alphabetical order, so they cannot be matched
to the English entries by position. Each spell is matched by what does not change between
languages: level, school, ritual, concentration, components, the numbers and dice in its text and
its length. Matching is a global best assignment (Hungarian algorithm), not a name lookup.

Usage (needs PyMuPDF: `pip install pymupdf`):

    python scripts/srd-translations/import_spells.py it path/to/SRD_CC_v5.1_IT.pdf

Official PDFs (CC-BY-4.0): https://www.dndbeyond.com/srd
"""

import collections
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Everything that differs between languages lives here. Schools are listed by a lowercase,
# accent-free stem and the English id they stand for (note Italian and French name conjuration
# and evocation differently from English).
LANGUAGES = {
    "it": {
        "labels": ["Tempo di lancio", "Gittata", "Componente|Componenti", "Durata"],
        "schools": {
            "abiurazione": "abjuration", "evocazione": "conjuration", "divinazione": "divination",
            "ammaliamento": "enchantment", "invocazione": "evocation", "illusione": "illusion",
            "necromanzia": "necromancy", "trasmutazione": "transmutation",
        },
        "higher": r"Ai livelli superiori\.",
        "concentration": "concentrazione",
        "end": "Trappole",
        "noise": r"^(Rivendita vietata|Systems Reference Document)",
    },
    "fr": {
        "labels": ["Temps d.incantation", "Port.e", "Composantes", "Dur.e"],
        "schools": {
            "abjuration": "abjuration", "invocation": "conjuration", "divination": "divination",
            "enchantement": "enchantment", "evocation": "evocation", "illusion": "illusion",
            "necromancie": "necromancy", "transmutation": "transmutation",
        },
        "higher": r". plus haut niveau\.",
        "concentration": "concentration",
        "end": "Pi.ges",
        "noise": r"^(Interdit . la revente|ce document pour votre|Document de R.f.rence)",
    },
    "de": {
        "labels": ["Zeitaufwand", "Reichweite", "Komponenten", "Wirkungsdauer"],
        "schools": {
            "bann": "abjuration", "beschworung": "conjuration", "erkenntnis": "divination",
            "verzauberung": "enchantment", "hervorrufung": "evocation", "illusion": "illusion",
            "nekromantie": "necromancy", "verwandlung": "transmutation",
        },
        "higher": r"Auf h.heren Graden:",
        "concentration": "konzentration",
        "end": "Fallen",
        "noise": r"^(Nicht f.r den Wiederverkauf|Systemreferenzdokument)",
        "component_letters": {"G": "S"},
    },
    "es": {
        "labels": ["Tiempo de lanzamiento", "Alcance", "Componentes", "Duraci.n"],
        "schools": {
            "abjuracion": "abjuration", "conjuracion": "conjuration", "adivinacion": "divination",
            "encantamiento": "enchantment", "evocacion": "evocation", "ilusionismo": "illusion",
            "nigromancia": "necromancy", "transmutacion": "transmutation",
        },
        "higher": r"A niveles superiores\.",
        "concentration": "concentraci",
        "end": "Trampas",
        "noise": r"^(Prohibida la reventa|o fotocopiar este documento|Documento de referencia del sistema)",
    },
}


def plain(text: str) -> str:
    """Lowercase without accents, to compare words in any of the languages."""
    return "".join(
        c for c in unicodedata.normalize("NFKD", text.lower()) if not unicodedata.combining(c)
    )


def pdf_lines(pdf: Path, noise: str) -> list[str]:
    import pymupdf

    lines = []
    for page in pymupdf.open(pdf):
        lines.extend(page.get_text().split("\n"))
    lines = [l.lstrip("\f") for l in lines]
    return [l for l in lines if not re.match(noise, l)]


def parse_spells(lang: str, lines: list[str]) -> list[dict]:
    cfg = LANGUAGES[lang]
    label_re = [re.compile(rf"^({lab}) ?:") for lab in cfg["labels"]]
    # A spell starts at its first label line (casting time); the two lines above hold the
    # title and the school/level line. Rules text can mention the label too, so the line
    # above must look like a school line (known school stem).
    def is_school_line(text: str) -> bool:
        p = plain(text)
        return len(text) < 70 and any(stem in p for stem in cfg["schools"])

    starts = [
        i - 2
        for i in range(2, len(lines))
        if label_re[0].match(lines[i]) and is_school_line(lines[i - 1])
    ]
    end_re = re.compile(rf"^{cfg['end']}\s*$")
    stop = next(i for i in range(starts[-1], len(lines)) if end_re.match(lines[i]))
    spells = []
    for n, s in enumerate(starts):
        block = lines[s : (starts[n + 1] if n + 1 < len(starts) else stop)]
        name, school_line = block[0].strip(), block[1].strip()
        p = plain(school_line)
        school = cfg["schools"][next(stem for stem in cfg["schools"] if stem in p)]
        digits = re.search(r"\d+", school_line)
        level = int(digits.group()) if digits else 0
        ritual = bool(re.search(r"\(ritu", p))

        fields: dict[int, str] = {}
        cur, idx = None, 2
        while idx < len(block):
            hit = next((k for k, rx in enumerate(label_re) if rx.match(block[idx])), None)
            if hit is not None and hit >= (cur if cur is not None else 0):
                cur = hit
                fields[cur] = re.sub(r"^[^:]*:", "", block[idx]).strip()
            elif cur is not None and cur != 3:
                fields[cur] += " " + block[idx].strip()
            else:
                break
            idx += 1

        paras, current = [], []
        for l in block[idx:]:
            if l.startswith(" ") and current:
                paras.append(" ".join(current))
                current = []
            current.append(l.strip())
        if current:
            paras.append(" ".join(current))
        paras = [re.sub(r"\s+", " ", x).strip() for x in paras if x.strip()]
        higher = None
        for k, para in enumerate(paras):
            m = re.match(cfg["higher"] + r"\s*", para)
            if m:
                higher = para[m.end() :].strip()
                paras.pop(k)
                break

        components = fields.get(2, "")
        letters = re.findall(r"\b([VSMG])\b", re.sub(r"\(.*", "", components))
        letters = [cfg.get("component_letters", {}).get(x, x) for x in letters]
        material = re.search(r"\((.*)\)", components)
        spells.append(
            {
                "name": name,
                "school": school,
                "schoolWord": school_line.split()[0],
                "level": level,
                "ritual": ritual,
                "components": sorted(set(letters)),
                "material": material.group(1).strip() if material else None,
                "castingTime": fields.get(0, ""),
                "range": fields.get(1, ""),
                "duration": fields.get(3, ""),
                "concentration": plain(fields.get(3, "")).startswith(cfg["concentration"]),
                "desc": "\n\n".join(paras),
                "higherLevel": higher,
            }
        )
    return spells


def tokens(text: str) -> collections.Counter:
    return collections.Counter(re.findall(r"\d+d\d+|\d+", re.sub(r"(\d+)[dDwW](\d+)", r"\1d\2", text)))


def hungarian(cost: list[list[float]]) -> list[int]:
    n = len(cost)
    inf = float("inf")
    u, v, p, way = [0.0] * (n + 1), [0.0] * (n + 1), [0] * (n + 1), [0] * (n + 1)
    for i in range(1, n + 1):
        p[0] = i
        j0 = 0
        minv, used = [inf] * (n + 1), [False] * (n + 1)
        while True:
            used[j0] = True
            i0, delta, j1 = p[j0], inf, 0
            for j in range(1, n + 1):
                if not used[j]:
                    cur = cost[i0 - 1][j - 1] - u[i0] - v[j]
                    if cur < minv[j]:
                        minv[j], way[j] = cur, j0
                    if minv[j] < delta:
                        delta, j1 = minv[j], j
            for j in range(n + 1):
                if used[j]:
                    u[p[j]] += delta
                    v[j] -= delta
                else:
                    minv[j] -= delta
            j0 = j1
            if p[j0] == 0:
                break
        while True:
            j1 = way[j0]
            p[j0] = p[j1]
            j0 = j1
            if j0 == 0:
                break
    answer = [0] * n
    for j in range(1, n + 1):
        answer[p[j] - 1] = j - 1
    return answer


def match(spells: list[dict]) -> tuple[dict, list]:
    entries = json.loads((ROOT / "data/srd51/spells.json").read_text(encoding="utf-8"))["entries"]
    english = json.loads((ROOT / "locales/en/srd51/spells.json").read_text(encoding="utf-8"))
    meta = {e["id"].split("/")[1]: e["data"] for e in entries}
    slugs = list(meta)

    def text(slug: str, field: str) -> str:
        return english.get(f"{slug}.{field}", "")

    def signature_en(slug: str):
        d = meta[slug]
        return (d["school"], d["ritual"], d["concentration"], tuple(sorted(set(d["components"]))))

    def cost(spell: dict, slug: str) -> float:
        ti = tokens(f'{spell["desc"]} {spell["higherLevel"] or ""} {spell["material"] or ""}')
        te = tokens(f'{text(slug, "desc")} {text(slug, "higherLevel")} {text(slug, "material")}')
        overlap = sum((ti & te).values()) / (sum((ti | te).values()) or 1)
        length_it = len(spell["desc"]) + len(spell["higherLevel"] or "")
        length_en = (len(text(slug, "desc")) + len(text(slug, "higherLevel"))) or 1
        value = -overlap * 100 + abs(length_it / length_en - 1.15) * 40
        for a, b in ((spell["castingTime"], text(slug, "castingTime")), (spell["duration"], text(slug, "duration"))):
            if tokens(a) == tokens(b):
                value -= 15
        # The level must agree. The rest of the signature is a heavy penalty rather than a wall,
        # so a school mislabelled in the PDF cannot block a match the text clearly supports.
        if spell["level"] != meta[slug]["level"]:
            value += 1000
        sig = (spell["school"], spell["ritual"], spell["concentration"], tuple(spell["components"]))
        if sig != signature_en(slug):
            value += 900
        return value

    size = max(len(spells), len(slugs))
    matrix = [
        [cost(spells[r], slugs[c]) if r < len(spells) and c < len(slugs) else 500 for c in range(size)]
        for r in range(size)
    ]
    result, doubtful = {}, []
    for r, c in enumerate(hungarian(matrix)):
        if r < len(spells) and c < len(slugs):
            result[slugs[c]] = spells[r]
            if matrix[r][c] > 0:
                doubtful.append((slugs[c], spells[r]["name"], round(matrix[r][c], 1)))
    return result, doubtful


def write_locale(lang: str, matched: dict) -> int:
    english = json.loads((ROOT / "locales/en/srd51/spells.json").read_text(encoding="utf-8"))
    out = {}
    for key in english:
        slug, _, field = key.partition(".")
        spell = matched.get(slug)
        if not spell:
            continue
        value = {
            "name": spell["name"], "desc": spell["desc"], "higherLevel": spell["higherLevel"],
            "material": spell["material"], "castingTime": spell["castingTime"],
            "range": spell["range"], "duration": spell["duration"],
        }.get(field)
        if value:
            out[key] = value
    target = ROOT / "locales" / lang / "srd51"
    target.mkdir(parents=True, exist_ok=True)
    (target / "spells.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return len(out)


def write_school_names(lang: str, spells: list[dict]) -> int:
    """School names are the first word of each spell's school line ("Evocazione di 3 livello").

    German writes the school inside a compound ("Bannzauber"), so its names are left to Weblate.
    """
    if lang == "de":
        return 0
    words: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    for spell in spells:
        if spell["level"] > 0:
            words[spell["school"]][spell["schoolWord"]] += 1
    english = json.loads((ROOT / "locales/en/srd51/schools.json").read_text(encoding="utf-8"))
    out = {
        f"{school}.name": counts.most_common(1)[0][0]
        for school, counts in words.items()
        if f"{school}.name" in english
    }
    (ROOT / "locales" / lang / "srd51" / "schools.json").write_text(
        json.dumps(dict(sorted(out.items())), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return len(out)


if __name__ == "__main__":
    lang, pdf = sys.argv[1], Path(sys.argv[2])
    parsed = parse_spells(lang, pdf_lines(pdf, LANGUAGES[lang]["noise"]))
    matched, doubtful = match(parsed)
    print(f"{lang}: parsed {len(parsed)} spells, matched {len(matched)}")
    for slug, name, value in sorted(doubtful, key=lambda x: -x[2])[:15]:
        print(f"  check: {slug} <- {name} ({value})")
    print("wrote", write_locale(lang, matched), "strings")
    print("school names:", write_school_names(lang, parsed))
