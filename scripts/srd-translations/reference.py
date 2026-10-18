"""Finds the small reference lists (abilities, skills, conditions, alignments) in a translated SRD.

Nothing here depends on translated titles: sections are found by shape and position, which is the
same in all four documents.
"""

import re

from pdf_sections import Section

ABILITY_ORDER = ["str", "dex", "con", "int", "wis", "cha"]


def abilities(secs: list[Section]) -> list[tuple[Section, Section | None]]:
    """The six "Using each ability" sections, each with its first "...checks" subsection.

    They are the only level-2 section whose children are exactly six level-3 sections.
    """
    for i, section in enumerate(secs):
        if section.level != 2:
            continue
        kids, j = [], i + 1
        while j < len(secs) and secs[j].level > 2:
            if secs[j].level == 3:
                kids.append(j)
            j += 1
        if len(kids) == 6 and all(secs[k + 1].level == 4 for k in kids):
            return [(secs[k], secs[k + 1]) for k in kids]
    raise LookupError("ability sections not found")


def ability_abbreviations(lines: list[str]) -> list[str]:
    """Six three-letter headers of the first monster stat block, in STR..CHA order."""
    for i in range(len(lines) - 6):
        window = [l.strip() for l in lines[i : i + 6]]
        if all(re.fullmatch(r"[A-ZÀ-Ü]{3}", w) for w in window) and len(set(window)) == 6:
            return window
    raise LookupError("ability abbreviations not found")


def skills_by_ability(check_sections: list[Section | None], counts: dict[str, int]) -> dict[str, list[tuple[str, str]]]:
    """Run-in skill paragraphs ("Athletics. ...") of each ability's checks section.

    `counts` says how many skills each ability has, in English order, so that the extra run-in
    paragraphs ("Other Strength checks.") are not mistaken for skills.
    """
    found: dict[str, list[tuple[str, str]]] = {}
    for ability, section in zip(ABILITY_ORDER, check_sections):
        items = []
        if section:
            for paragraph in section.body:
                m = re.match(r"^([^.:\-][^.:]{1,40})[.:] (.+)$", paragraph)
                if m and not paragraph.startswith("- "):
                    items.append((m.group(1).strip(), m.group(2).strip()))
        found[ability] = items[: counts.get(ability, 0)]
    return found


def conditions(secs: list[Section]) -> list[Section]:
    """Level-4 sections of the appendix that follows the monster chapters."""
    last_monster_letter = max(
        (i for i, s in enumerate(secs) if s.level == 2 and re.search(r"\(Z\)\s*$", s.title)),
        default=None,
    )
    if last_monster_letter is None:
        raise LookupError("end of the monster chapter not found")
    out, started = [], False
    for s in secs[last_monster_letter + 1 :]:
        if s.level == 1 and started and len(out) >= 5:
            break
        if s.level == 4:
            started = True
            out.append(s)
    return out


def alignments(secs: list[Section]) -> list[tuple[str, str]]:
    """The nine alignment paragraphs: (abbreviation, text), in English order."""
    for s in secs:
        hits = [(i, re.search(r"\(([A-ZÀ-Ü]{1,2})\)", p)) for i, p in enumerate(s.body)]
        run = [(i, m) for i, m in hits if m]
        if len(run) == 9 and [i for i, _ in run] == list(range(run[0][0], run[0][0] + 9)):
            return [(m.group(1), s.body[i]) for i, m in run]
    raise LookupError("alignment paragraphs not found")
