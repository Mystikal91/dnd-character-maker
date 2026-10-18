"""Reads an official SRD 5.1 PDF into a flat list of sections with their heading level.

All four translations share the same design: body text is Cambria 10 and headings are Calibri,
whose size gives the level (26 chapter, 18 section, 14 feature, 12 sub-feature). That makes the
structure recoverable from fonts alone, with no machine learning.

    for s in read_sections(pdf):
        s.level, s.title, s.body   # body is a list of paragraphs
"""

import re
from dataclasses import dataclass, field
from pathlib import Path

LEVEL_BY_SIZE = {26: 1, 18: 2, 14: 3, 12: 4, 11: 4}
BODY_FONTS = ("Cambria",)
NOISE = re.compile(
    r"^(Rivendita vietata|Systems Reference Document|Interdit . la revente|ce document pour votre"
    r"|Document de R.f.rence|Nicht f.r den Wiederverkauf|Systemreferenzdokument|Prohibida la reventa"
    r"|o fotocopiar este documento|Documento de referencia del sistema)"
)


@dataclass
class Section:
    level: int
    title: str
    page: int
    column: int  # 0 left, 1 right
    body: list[str] = field(default_factory=list)


def _heading_level(first_span: dict) -> int | None:
    if not first_span["font"].startswith("Calibri") or first_span["font"].endswith("Bold"):
        return None
    return LEVEL_BY_SIZE.get(round(first_span["size"]))


def read_sections(pdf: Path, dehyphenate: bool = False) -> list[Section]:
    import pymupdf

    sections: list[Section] = [Section(0, "", 0, 0)]
    paragraph: list[str] = []

    def flush() -> None:
        if paragraph:
            if dehyphenate:
                # German breaks long compounds at line ends: "Geschicklich-" + "keitswurf".
                joined = paragraph[0]
                for nxt in paragraph[1:]:
                    if joined.endswith("-") and joined[-2:-1].isalpha() and nxt[:1].islower():
                        joined = joined[:-1] + nxt
                    else:
                        joined = f"{joined} {nxt}"
            else:
                joined = " ".join(paragraph)
            text = re.sub(r"\s+", " ", joined).strip()
            if text:
                sections[-1].body.append(text)
            paragraph.clear()

    last_heading_bottom = None
    in_list = False
    for pno, page in enumerate(pymupdf.open(pdf), start=1):
        width = page.rect.width
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [s for s in line["spans"] if s["text"].strip()]
                if not spans:
                    continue
                text = "".join(s["text"] for s in line["spans"])
                if NOISE.match(text.strip()):
                    continue
                level = _heading_level(spans[0])
                column = 1 if line["bbox"][0] > width / 2 - 5 else 0
                if level:
                    title = "".join(s["text"] for s in spans).strip()
                    prev = sections[-1]
                    top = line["bbox"][1]
                    wrapped = (
                        not prev.body
                        and prev.level == level
                        and prev.page == pno
                        and prev.column == column
                        and last_heading_bottom is not None
                        and 0 <= top - last_heading_bottom < 5
                    )
                    flush()
                    in_list = False
                    if wrapped:
                        prev.title = f"{prev.title} {title}"
                    else:
                        sections.append(Section(level, title, pno, column))
                    last_heading_bottom = line["bbox"][3]
                    continue
                # Bullets and run-in bold terms use other fonts, so judge the line by the font
                # that carries most of its characters.
                main = max(spans, key=lambda s: len(s["text"].strip()))
                if main["font"] == "Calibri-Bold" and main["size"] >= 11:
                    # A bold title inside a section (an ancestry name, a table caption): keep it
                    # as a paragraph of its own so it does not glue to the text around it.
                    flush()
                    paragraph.append(text.strip())
                    flush()
                    continue
                if not main["font"].startswith(BODY_FONTS):
                    continue  # table cells, captions and running heads
                stripped = text.strip()
                # Text of a column starts at a fixed x; list items hang a little to its right.
                left = (0.093 if column == 0 else 0.536) * width
                hanging = line["bbox"][0] > left + 8
                if stripped.startswith("•"):
                    # List items are their own paragraphs, written as in the English files.
                    flush()
                    stripped = "- " + stripped[1:].strip()
                    in_list = True
                elif in_list and not hanging:
                    # Back at the column edge: the list is over and a new paragraph starts.
                    flush()
                    in_list = False
                elif text.startswith(" ") and paragraph:
                    flush()
                paragraph.append(stripped)
    flush()
    return sections
