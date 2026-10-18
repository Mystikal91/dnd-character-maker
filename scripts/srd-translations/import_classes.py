"""Imports class, subclass and feature texts from an official SRD 5.1 translation.

    python scripts/srd-translations/import_classes.py it path/to/SRD_CC_v5.1_IT.pdf

A class chapter has the same shape in every language: a "class features" section with the hit
points / proficiencies / equipment blocks, one level-3 section per feature, an optional
spellcasting section made of level-4 sections, and finally the subclass as a level-3 section
whose level-4 sections are its features. Classes are paired with English ids through a glossary.
Features are paired by name groups, order and length; anything uncertain stays in English.
"""

import collections
import json
import math
import re
import sys
from pathlib import Path

from import_reference import key, load_en, write
from import_spells import hungarian
from pdf_sections import Section, read_sections

ROOT = Path(__file__).resolve().parents[2]

CLASSES = {
    "it": {"barbaro": "barbarian", "bardo": "bard", "chierico": "cleric", "druido": "druid",
           "guerriero": "fighter", "ladro": "rogue", "mago": "wizard", "monaco": "monk",
           "paladino": "paladin", "ranger": "ranger", "stregone": "sorcerer",
           "warlock": "warlock"},
    "fr": {"barbare": "barbarian", "barde": "bard", "clerc": "cleric", "druide": "druid",
           "ensorceleur": "sorcerer", "guerrier": "fighter", "magicien": "wizard",
           "moine": "monk", "occultiste": "warlock", "paladin": "paladin", "rodeur": "ranger",
           "roublard": "rogue"},
    "de": {"barbar": "barbarian", "barde": "bard", "druide": "druid", "hexenmeister": "warlock",
           "kaempfer": "fighter", "kleriker": "cleric", "magier": "wizard", "moench": "monk",
           "paladin": "paladin", "schurke": "rogue", "waldlaeufer": "ranger",
           "zauberer": "sorcerer"},
    "es": {"barbaro": "barbarian", "bardo": "bard", "brujo": "warlock", "clerigo": "cleric",
           "druida": "druid", "explorador": "ranger", "guerrero": "fighter",
           "hechicero": "sorcerer", "mago": "wizard", "monje": "monk", "paladin": "paladin",
           "picaro": "rogue"},
}


def merge_split_headings(secs: list[Section]) -> list[Section]:
    """A heading wrapped over two lines with a gap in between arrives as an empty section
    followed by a same-level section on the same page: join them."""
    out: list[Section] = []
    for s in secs:
        prev = out[-1] if out else None
        if (
            prev
            and prev.level == s.level >= 3
            and not prev.body
            and prev.page == s.page
            and prev.column == s.column
            and s.title[:1].islower()
        ):
            prev.title = f"{prev.title} {s.title}"
            prev.body = s.body
            continue
        out.append(s)
    return out


def base_name(name: str) -> str:
    return re.sub(r"\s*\(.*?\)\s*$", "", name).strip()


def tokens(text: str) -> set[str]:
    return set(re.findall(r"\d+d\d+|\d+", text))


def match_groups(
    headings: list[Section], groups: list[list[str]], names: dict, descs: dict, limit: float = 20
):
    """Pairs PDF headings with English name groups. Returns {group index: Section}."""
    size = max(len(headings), len(groups))
    cost = [[400.0] * size for _ in range(size)]
    for r, h in enumerate(headings):
        text = " ".join(h.body)
        for c, group in enumerate(groups):
            en = descs.get(group[0], "")
            length = abs(math.log(max(len(text), 1) / max(len(en), 1) / 1.2)) * 30
            shared = len(tokens(text) & tokens(en)) - len(tokens(text) ^ tokens(en)) * 0.3
            cost[r][c] = length + abs(r - c) * 6 - shared * 12
    result = {}
    for r, c in enumerate(hungarian(cost)):
        if r < len(headings) and c < len(groups) and cost[r][c] < limit:
            result[c] = (headings[r], cost[r][c])
    return result


def run(lang: str, pdf: Path) -> None:
    secs = merge_split_headings(read_sections(pdf, dehyphenate=(lang == "de")))
    class_data = json.loads((ROOT / "data/srd51/classes.json").read_text(encoding="utf-8"))["entries"]
    sub_data = json.loads((ROOT / "data/srd51/subclasses.json").read_text(encoding="utf-8"))["entries"]
    feat_data = json.loads((ROOT / "data/srd51/features.json").read_text(encoding="utf-8"))["entries"]
    en_classes, en_subs, en_feats = load_en("classes"), load_en("subclasses"), load_en("features")
    f_names = {k[:-5]: v for k, v in en_feats.items() if k.endswith(".name")}
    f_descs = {k[:-5]: v for k, v in en_feats.items() if k.endswith(".desc")}

    classes_out: dict = {}
    subs_out: dict = {}
    feats_out: dict = {}
    notes: list[str] = []

    chapters = [i for i, s in enumerate(secs) if s.level == 1 and key(s.title) in CLASSES[lang]]
    for n, i in enumerate(chapters):
        slug = CLASSES[lang][key(secs[i].title)]
        end = next((j for j in range(i + 1, len(secs)) if secs[j].level == 1), len(secs))
        chapter = secs[i:end]
        classes_out[f"{slug}.name"] = secs[i].title

        l2 = next((s for s in chapter if s.level == 2), None)
        l2_end = next((j for j, s in enumerate(chapter) if s.level == 2 and s is not l2 and j > 0), len(chapter))
        l3_first = next((j for j, s in enumerate(chapter) if s.level == 3), len(chapter))
        std = [s for s in chapter[:l3_first] if s.level == 4]
        if len(std) >= 3:  # hit points, proficiencies, equipment
            bullets = [p[2:].strip().rstrip(";.") for p in std[2].body if p.startswith("- ")]
            for k, text in enumerate(bullets, start=1):
                if f"{slug}.startingEquipment.{k}" in en_classes:
                    classes_out[f"{slug}.startingEquipment.{k}"] = text

        # Level-3 sections of the class, split into plain features, spellcasting and subclass.
        l3 = [(j, s) for j, s in enumerate(chapter) if s.level == 3]
        kids = {j: [] for j, _ in l3}
        for j, s in l3:
            k = j + 1
            while k < len(chapter) and chapter[k].level > 3:
                kids[j].append(chapter[k])
                k += 1
        sub_idx = None
        spell_idx = None
        parents = [j for j, _ in l3 if any(k.body for k in kids[j])]
        if parents:
            sub_idx = parents[-1]  # the last section with level-4 children is the subclass
        if f"{slug}.spellcasting.1.name" in en_classes:
            # The spellcasting section is the one whose text looks most like the English one.
            wanted = " ".join(
                v for k, v in en_classes.items()
                if k.startswith(f"{slug}.spellcasting.") and k.endswith(".desc")
            )
            best = None
            for j in parents:
                if j == sub_idx:
                    continue
                text = " ".join(p for k in kids[j] for p in k.body)
                score = -abs(math.log(max(len(text), 1) / max(len(wanted), 1) / 1.2)) + 0.05 * len(
                    tokens(text) & tokens(wanted)
                )
                if best is None or score > best[0]:
                    best = (score, j)
            spell_idx = best[1] if best else None
        if spell_idx is not None:
            parts = [k for k in kids[spell_idx] if k.body]
            count = len([k for k in en_classes if k.startswith(f"{slug}.spellcasting.") and k.endswith(".name")])
            for k, part in enumerate(parts[:count], start=1):
                classes_out[f"{slug}.spellcasting.{k}.name"] = part.title
                classes_out[f"{slug}.spellcasting.{k}.desc"] = "\n\n".join(part.body)
            notes.append(f"{slug}: spellcasting {len(parts)} parts (English {count})")
            head = chapter[spell_idx]
            feats_out[f"spellcasting-{slug}.name"] = f"{head.title}: {secs[i].title}"
            if head.body:
                feats_out[f"spellcasting-{slug}.desc"] = "\n\n".join(head.body)

        # Features of the class itself.
        plain = [s for j, s in l3 if j != spell_idx and j != sub_idx and s.body]
        slugs = [e["id"].split("/")[1] for e in feat_data
                 if e["data"]["class"].endswith(f"/{slug}") and not e["data"].get("subclass") and not e.get("parent")
                 and e["id"].split("/")[1] != f"spellcasting-{slug}"]
        flavor_slug = None
        mapped = pair_features(plain, slugs, f_names, f_descs, feats_out, notes, f"{slug}")

        # The subclass and its features.
        if sub_idx is not None:
            head = chapter[sub_idx]
            sub_entry = next((e for e in sub_data if e["parent"].endswith(f"/{slug}")), None)
            if sub_entry:
                sub_slug = sub_entry["id"].split("/")[1]
                subs_out[f"{sub_slug}.name"] = head.title
                if head.body:
                    subs_out[f"{sub_slug}.desc"] = "\n\n".join(head.body)
                flavor = en_subs.get(f"{sub_slug}.flavor")
                for fs, section in mapped.items():
                    if f_names.get(fs) == flavor:
                        subs_out[f"{sub_slug}.flavor"] = section.title
                sub_slugs = [e["id"].split("/")[1] for e in feat_data
                             if e["data"]["class"].endswith(f"/{slug}") and e["data"].get("subclass", "").endswith(f"/{sub_slug}")
                             and not e.get("parent")]
                pair_features(
                    [k for k in kids[sub_idx] if k.body], sub_slugs, f_names, f_descs, feats_out, notes, sub_slug, exact=True
                )
        else:
            notes.append(f"{slug}: no subclass section found")

    print(lang, "classes", write(lang, "classes", classes_out),
          "subclasses", write(lang, "subclasses", subs_out),
          "features", write(lang, "features", feats_out))
    if "-v" in sys.argv:
        print("\n".join(notes))


def pair_features(headings, slugs, f_names, f_descs, out, notes, label, exact=False) -> dict:
    """Groups English features by name, pairs the groups with headings, writes name and desc."""
    groups: dict[str, list[str]] = collections.OrderedDict()
    for s in slugs:
        groups.setdefault(f_names.get(s, s), []).append(s)
    # A name with a parenthesis ("Brutal Critical (1 die)") or one that repeats under another
    # variant has no single heading in the PDF: leave those in English.
    bases = collections.Counter(base_name(n) for n in groups)
    usable = [g for n, g in groups.items() if bases[base_name(n)] == 1 and "(" not in n]
    usable = [g for g in usable if not re.search(r"\bfeature$|\bimprovement$", f_names.get(g[0], ""))]
    # Names with a colon ("Channel Divinity: Turn Undead") and the generic spell lists have no
    # heading of their own in the PDF.
    if not exact:
        usable = [
            g for g in usable
            if ":" not in f_names.get(g[0], "") and not f_names.get(g[0], "").endswith(" Spells")
        ]
    found = match_groups(
        headings, usable, f_names, f_descs, limit=1000 if exact and len(headings) == len(usable) else 25
    )
    mapped = {}
    for index, (section, price) in found.items():
        group = usable[index]
        descs_en = {f_descs.get(s) for s in group}
        for s in group:
            out[f"{s}.name"] = section.title
            if len(descs_en) == 1:
                out[f"{s}.desc"] = "\n\n".join(section.body)
        mapped[group[0]] = section
        notes.append(f"  {label}: {f_names.get(group[0])} -> {section.title} ({price:.0f})")
    skipped = [n for n in groups if all(n != f_names.get(g[0]) for g in [usable[i] for i in found])]
    notes.append(f"  {label}: {len(found)} of {len(groups)} English names paired, {len(headings)} headings; left in English: {skipped}")
    return mapped


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    run(sys.argv[1], Path(sys.argv[2]))
