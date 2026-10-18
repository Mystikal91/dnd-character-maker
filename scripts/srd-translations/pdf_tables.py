"""Reads table rows from an SRD PDF.

Table cells are Calibri 9 (bold for headers, italic for group titles), each cell its own text
line. Rows are cells that share a baseline; the cell text is kept in reading order.
"""

import re
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Row:
    page: int
    y: float
    cells: list[tuple[float, str]] = field(default_factory=list)
    kind: str = "row"  # row, header or group

    @property
    def texts(self) -> list[str]:
        return [t for _, t in self.cells]


def read_rows(pdf: Path, first_page: int = 1, last_page: int = 10**6) -> list[Row]:
    import pymupdf

    rows: list[Row] = []
    for pno, page in enumerate(pymupdf.open(pdf), start=1):
        if not first_page <= pno <= last_page:
            continue
        width = page.rect.width
        found: list[tuple[float, float, str, str]] = []
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [s for s in line["spans"] if s["text"].strip()]
                if not spans or not spans[0]["font"].startswith("Calibri"):
                    continue
                if round(spans[0]["size"]) != 9:
                    continue
                text = re.sub(r"\s+", " ", "".join(s["text"] for s in spans)).strip()
                found.append((line["bbox"][1], line["bbox"][0], text, spans[0]["font"]))
        found.sort()
        current: Row | None = None
        for y, x, text, font in found:
            if current is None or abs(y - current.y) > 3:
                current = Row(pno, y)
                rows.append(current)
            current.cells.append((x, text))
            if font.endswith("Italic"):
                current.kind = "group"
            elif font.endswith("Bold"):
                current.kind = "header"
        for row in rows:
            row.cells.sort()
    return rows
