"""Renders the first pages of every PDF in a folder to PNG (needs pymupdf): python render.py <folder> [dpi]."""
import glob
import os
import sys

import pymupdf

folder = sys.argv[1]
dpi = int(sys.argv[2]) if len(sys.argv) > 2 else 70
for path in sorted(glob.glob(os.path.join(folder, "*.pdf"))):
    doc = pymupdf.open(path)
    base = os.path.splitext(os.path.basename(path))[0]
    print(base, "pages:", len(doc))
    for i, page in enumerate(doc):
        if i >= 4:
            break
        page.get_pixmap(dpi=dpi).save(os.path.join(folder, f"{base}-{i + 1}.png"))
