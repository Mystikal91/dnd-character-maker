"""Imports the features that come in numbered variants ("Action Surge (2 uses)", "Bardic
Inspiration (d8)") from an official SRD 5.1 translation.

    python scripts/srd-translations/import_variants.py it path/to/SRD_CC_v5.1_IT.pdf

Run it after `import_classes.py` and `import_options.py`. The PDF has one section for the whole
family; every variant gets that section's title with its own suffix, translated here with a short
table, and the section's text when all the variants share one English text.
"""

import json
import math
import re
import sys
from pathlib import Path

from import_classes import CLASSES, merge_split_headings, tokens
from import_options import load_target, save_target
from import_reference import ROOT, key, load_en
from import_spells import hungarian
from pdf_sections import read_sections

# (English pattern, {language: template}); {1} is the first captured group.
SUFFIXES = [
    (r"1 use", {"it": "1 uso", "fr": "1 utilisation", "de": "1 Anwendung", "es": "1 uso"}),
    (r"2 uses", {"it": "2 usi", "fr": "2 utilisations", "de": "2 Anwendungen", "es": "2 usos"}),
    (r"3 uses", {"it": "3 usi", "fr": "3 utilisations", "de": "3 Anwendungen", "es": "3 usos"}),
    (r"1 die", {"it": "1 dado", "fr": "1 dé", "de": "1 Würfel", "es": "1 dado"}),
    (r"(\d) dice", {"it": "{1} dadi", "fr": "{1} dés", "de": "{1} Würfel", "es": "{1} dados"}),
    (r"(\d)/rest", {"it": "{1}/riposo", "fr": "{1}/repos", "de": "{1}/Rast", "es": "{1}/descanso"}),
    (r"CR ([\d/]+) or below", {"it": "GS {1} o inferiore", "fr": "FP {1} ou moins", "de": "HG {1} oder niedriger", "es": "VD {1} o inferior"}),
    (r"CR ([\d/]+) or below, no flying speed", {"it": "GS {1} o inferiore, senza velocità di volo", "fr": "FP {1} ou moins, sans vitesse de vol", "de": "HG {1} oder niedriger, keine Flugbewegungsrate", "es": "VD {1} o inferior, sin velocidad de vuelo"}),
    (r"CR ([\d/]+) or below, no flying or swim speed", {"it": "GS {1} o inferiore, senza velocità di volo o di nuoto", "fr": "FP {1} ou moins, sans vitesse de vol ni de nage", "de": "HG {1} oder niedriger, keine Flug- oder Schwimmbewegungsrate", "es": "VD {1} o inferior, sin velocidad de vuelo ni de nado"}),
    (r"1 type", {"it": "1 tipo", "fr": "1 type", "de": "1 Art", "es": "1 tipo"}),
    (r"2 types", {"it": "2 tipi", "fr": "2 types", "de": "2 Arten", "es": "2 tipos"}),
    (r"3 enemies", {"it": "3 nemici", "fr": "3 ennemis", "de": "3 Feinde", "es": "3 enemigos"}),
    (r"1 terrain type", {"it": "1 tipo di terreno", "fr": "1 type de terrain", "de": "1 Geländetyp", "es": "1 tipo de terreno"}),
    (r"(\d) terrain types", {"it": "{1} tipi di terreno", "fr": "{1} types de terrain", "de": "{1} Geländetypen", "es": "{1} tipos de terreno"}),
    (r"(\d)th level", {"it": "{1}° livello", "fr": "{1}e niveau", "de": "{1}. Grad", "es": "nivel {1}"}),
    (r"d\d+", {}),  # dice sizes stay as they are
    (r"\d", {}),  # a bare number stays as it is
]


def translate_suffix(lang: str, text: str) -> str | None:
    for pattern, templates in SUFFIXES:
        m = re.fullmatch(pattern, text)
        if not m:
            continue
        if not templates:
            return text
        template = templates.get(lang)
        if template:
            return template.replace("{1}", m.group(1) if m.groups() else "")
    return None


def split_name(name: str) -> tuple[str, str | None]:
    m = re.fullmatch(r"(.*?) \((.*)\)", name)
    return (m.group(1), m.group(2)) if m else (name, None)


def run(lang: str, pdf: Path) -> None:
    secs = merge_split_headings(read_sections(pdf, dehyphenate=(lang == "de")))
    en = load_en("features")
    names = {k[:-5]: v for k, v in en.items() if k.endswith(".name")}
    descs = {k[:-5]: v for k, v in en.items() if k.endswith(".desc")}
    feats = json.loads((ROOT / "data/srd51/features.json").read_text(encoding="utf-8"))["entries"]
    owner = {e["id"].split("/")[1]: e["data"].get("class", "").split("/")[-1] for e in feats}
    out = load_target(lang, "features")
    done = {s for s in names if out.get(f"{s}.name")}
    notes = []

    # Variant groups per class: slugs that share a base name, none translated yet.
    groups: dict[tuple[str, str], list[str]] = {}
    for s, name in names.items():
        if s in done:
            continue
        base, suffix = split_name(name)
        if suffix is None and not re.match(r".* \(\d\)$", name) and not s.startswith("extra-attack"):
            continue
        groups.setdefault((owner.get(s, ""), base), []).append(s)

    chapters = [i for i, s in enumerate(secs) if s.level == 1 and key(s.title) in CLASSES[lang]]
    for i in chapters:
        slug = CLASSES[lang][key(secs[i].title)]
        end = next((j for j in range(i + 1, len(secs)) if secs[j].level == 1), len(secs))
        heads = [s for s in secs[i:end] if s.level == 3 and s.body]
        mine = [(k, v) for k, v in groups.items() if k[0] == slug]
        if not mine:
            continue
        cost = [[400.0] * max(len(heads), len(mine)) for _ in range(max(len(heads), len(mine)))]
        for r, head in enumerate(heads):
            text = " ".join(head.body)
            for c, ((_, base), variants) in enumerate(mine):
                en_text = descs.get(variants[0], "")
                length = abs(math.log(max(len(text), 1) / max(len(en_text), 1) / 1.2)) * 30
                shared = len(tokens(text) & tokens(en_text)) - len(tokens(text) ^ tokens(en_text)) * 0.3
                cost[r][c] = length - shared * 12
        for r, c in enumerate(hungarian(cost)):
            if r >= len(heads) or c >= len(mine) or cost[r][c] > 25:
                continue
            head = heads[r]
            (_, base), variants = mine[c]
            same = len({descs.get(v) for v in variants}) == 1
            for v in variants:
                _, suffix = split_name(names[v])
                if suffix is None:
                    m = re.fullmatch(r".* \((\d)\)", names[v])
                    suffix = m.group(1) if m else None
                translated = translate_suffix(lang, suffix) if suffix else None
                out[f"{v}.name"] = f"{head.title} ({translated})" if translated else head.title
                if same:
                    out[f"{v}.desc"] = "\n\n".join(head.body)
            notes.append(f"{slug}: {base} -> {head.title} ({cost[r][c]:.0f}) {'desc' if same else 'name only'}")
            if "-t" in sys.argv:
                print(f"{slug}: {base} [{cost[r][c]:.0f}] -> {head.title}: {' '.join(head.body)[:80]}")

    save_target(lang, "features", out)
    print(lang, "features", len([k for k in out if out[k]]))
    if "-v" in sys.argv:
        print("\n".join(notes))


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    run(sys.argv[1], Path(sys.argv[2]))
