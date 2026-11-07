"""Imports the descriptions of the equipment (adventuring gear, tools, mounts and vehicles).

    python scripts/srd-translations/import_equipment_texts.py it path/to/SRD_CC_v5.1_IT.pdf [--write]

The book prints each description as a paragraph that starts with the name of the thing and a
period ("Acid. As an action, you can splash..."). The names were paired earlier (`import_tables.py`,
`import_equipment.py`), so a paragraph belongs to the item whose translated name, without its
parentheses, is the paragraph's title. What is not found is listed: it is either text that only the
English data has (the contents of a pack) or a name the book writes differently. Without `--write`
it only reports; with it, it writes only keys that are still empty.
"""

import json
import re
import sys
from pathlib import Path

from import_reference import ROOT, key, load_en
from import_spells import LANGUAGES, pdf_lines

PARAGRAPH = re.compile(r"^[  ]+([A-ZÀ-ÝÄÖÜ][^.:]{1,60}?)[.:] ?(.*)$")


FOOTER = re.compile(
    r"Documento de referencia|Document de R[ée]f[ée]rence|Systemreferenzdokument|Systems Reference Document|"
    r"Rivendita vietata|Interdit à la revente|Nicht für den Wiederverkauf|Prohibida la reventa|Reventa prohibida|"
    r"imprimir o fotocopiar|imprimer ou photocopier|Privatgebrauch|uso personale|personal use"
)


def paragraphs(lines: list[str], lang: str) -> list[tuple[str, str]]:
    """(title, text) of every paragraph that starts with " Title. " in the equipment chapter."""
    out: list[list[str]] = []
    for line in lines:
        if FOOTER.search(line) or re.fullmatch(r"\s*\d{1,3}\s*", line):
            continue  # the running head or foot of a page, and its number
        m = PARAGRAPH.match(line)
        if m:
            out.append([m.group(1).strip(), m.group(2)])
        elif out and line.strip() and not re.match(r"^<<", line):
            out[-1][1] += ("" if out[-1][1].endswith("-") and lang == "de" else " ") + line.strip()
    return [(t, re.sub(r"\s+", " ", x).strip()) for t, x in out]


def core(name: str) -> str:
    return key(re.sub(r"\s*\(.*$", "", name).replace("’", "'"))


# The English data repeats one paragraph of the book for every item of a family: the title of that
# paragraph in each language (it, fr, de, es), then the slugs that share it.
FAMILIES: list[tuple[tuple[str, str, str, str], tuple[str, ...]]] = [
    (("Focus arcano", "Focaliseur arcanique", "Arkaner Fokus", "Canalizador arcano"), ("crystal", "orb", "rod", "staff", "wand")),
    (("Focus druidico", "Focaliseur druidique", "Druidischer Fokus", "Canalizador druídico"), ("sprig-of-mistletoe", "totem", "wooden-staff", "yew-wand")),
    (("Simbolo sacro", "Symbole sacré", "Heiliges Symbol", "Símbolo sagrado"), ("amulet", "emblem", "reliquary")),
    (("Strumenti da artigiano", "Outils d’artisan", "Handwerkszeug", "Herramientas de artesano"),
     ("alchemists-supplies", "brewers-supplies", "calligraphers-supplies", "carpenters-tools", "cartographers-tools", "cobblers-tools",
      "cooks-utensils", "glassblowers-tools", "jewelers-tools", "leatherworkers-tools", "masons-tools", "painters-supplies",
      "potters-tools", "smiths-tools", "tinkers-tools", "weavers-tools", "woodcarvers-tools")),
    (("Giochi", "Boîte de jeux", "Spiel", "Juegos"), ("dice-set", "playing-card-set")),
    (("Strumenti musicali", "Instrument de musique", "Musikinstrument", "Instrumentos musicales"),
     ("bagpipes", "drum", "dulcimer", "flute", "lute", "lyre", "horn", "pan-flute", "shawm", "viol")),
    (("Bardatura", "Barde", "Rossharnisch", "Barda"),
     ("barding-padded", "barding-leather", "barding-studded-leather", "barding-hide", "barding-chain-shirt", "barding-scale-mail",
      "barding-breastplate", "barding-half-plate", "barding-ring-mail", "barding-chain-mail", "barding-splint", "barding-plate")),
    (("", "", "", "Estuche para mapas o pergaminos"), ("case-map-or-scroll",)),
    (("Imbarcazioni a remi","Bateaux à rames", "Ruderfahrzeuge", "Barcos de remos"), ("keelboat", "rowboat")),
]
# One paragraph about both saddles: all its sentences but the last are about the military saddle.
SADDLE_TITLES = ("Selle", "Selles", "Sättel", "Sillas")

# Things the English data describes with a line of its own, taken from a pack (it, fr, de, es).
HOMEMADE: dict[str, tuple[str, str, str, str]] = {
    "alms-box": ("Una piccola cassetta per le offerte, di solito presente nella dotazione da sacerdote.",
                 "Un petit tronc à offrandes, que l’on trouve généralement dans le paquetage d’ecclésiastique.",
                 "Ein kleiner Klingelbeutel, der sich üblicherweise in der Priesterausrüstung findet.",
                 "Una pequeña caja para limosnas, que suele encontrarse en el paquete de sacerdote."),
    "block-of-incense": ("Un cubetto di incenso, di solito presente nella dotazione da sacerdote.",
                         "Un bloc d’encens, que l’on trouve généralement dans le paquetage d’ecclésiastique.",
                         "Ein Block Weihrauch, der sich üblicherweise in der Priesterausrüstung findet.",
                         "Una barra de incienso, que suele encontrarse en el paquete de sacerdote."),
    "censer": ("Un incensiere, di solito presente nella dotazione da sacerdote.",
               "Un encensoir, que l’on trouve généralement dans le paquetage d’ecclésiastique.",
               "Ein Räuchergefäß, das sich üblicherweise in der Priesterausrüstung findet.",
               "Un incensario, que suele encontrarse en el paquete de sacerdote."),
    "vestments": ("Abiti religiosi, di solito presenti nella dotazione da sacerdote.",
                  "Des habits liturgiques, que l’on trouve généralement dans le paquetage d’ecclésiastique.",
                  "Religiöse Kleidung, die sich üblicherweise in der Priesterausrüstung findet.",
                  "Ropa religiosa, que suele encontrarse en el paquete de sacerdote."),
    "little-bag-of-sand": ("Un piccolo sacchetto di sabbia, di solito presente nella dotazione da studioso.",
                           "Un petit sac de sable, que l’on trouve généralement dans le paquetage d’érudit.",
                           "Ein kleiner Beutel mit Sand, der sich üblicherweise in der Gelehrtenausrüstung findet.",
                           "Una bolsita con arena, que suele encontrarse en el paquete de erudito."),
    "small-knife": ("Un coltellino, di solito presente nella dotazione da studioso.",
                    "Un petit couteau, que l’on trouve généralement dans le paquetage d’érudit.",
                    "Ein kleines Messer, das sich üblicherweise in der Gelehrtenausrüstung findet.",
                    "Un cuchillo pequeño, que suele encontrarse en el paquete de erudito."),
    "string-10-feet": ("Un pezzo di spago lungo 3 metri, di solito presente nella dotazione da scassinatore.",
                       "Une ficelle de 3 m, que l’on trouve généralement dans le paquetage de cambrioleur.",
                       "Eine drei Meter lange Schnur, die sich üblicherweise in der Einbrecherausrüstung findet.",
                       "Un trozo de cordel de 3 m, que suele encontrarse en el paquete de ladrón."),
}
LANGS = ("it", "fr", "de", "es")


def sentences(text: str) -> list[str]:
    return re.split(r"(?<=[.!?])\s+(?=[A-ZÀ-ÝÄÖÜ])", text)


def main(lang: str, pdf: Path, write: bool) -> None:
    lines = pdf_lines(pdf, LANGUAGES[lang]["noise"])
    paras = paragraphs(lines, lang)
    english = load_en("items")
    data = json.loads((ROOT / "data/srd51/items.json").read_text(encoding="utf-8"))["entries"]
    category = {e["id"].split("/")[1]: e["data"]["category"] for e in data}
    path = ROOT / "locales" / lang / "srd51" / "items.json"
    raw = path.read_bytes().decode("utf-8")
    newline = "\r\n" if "\r\n" in raw else "\n"
    current = json.loads(raw)
    by_title: dict[str, list[str]] = {}
    for title, text in paras:
        by_title.setdefault(key(title.replace("’", "'")), []).append(text)
    added, unmatched = 0, []
    for k in english:
        if not k.endswith(".desc") or current.get(k):
            continue
        slug = k[:-5]
        if category.get(slug) in (None, "magic-items", "armor", "weapon"):
            continue
        column = LANGS.index(lang)
        name = current.get(f"{slug}.name", "")
        texts = by_title.get(core(name))
        for titles, slugs in FAMILIES:
            if slug in slugs and titles[column]:
                texts = by_title.get(key(titles[column].replace("’", "'"))) or texts
        if slug in HOMEMADE:
            texts = [HOMEMADE[slug][column]]
        if slug in ("saddle-exotic", "saddle-military"):
            parts = sentences((by_title.get(key(SADDLE_TITLES[column])) or [""])[0])
            if len(parts) >= 3:
                texts = [" ".join(parts[:-1]) if slug == "saddle-military" else parts[-1]]
        if not texts:  # the book's title may be shorter or longer than the item's name
            wanted = core(name)
            near = [t for t in by_title if len(t) >= 4 and (wanted.startswith(t) or t.startswith(wanted))]
            if near:
                texts = by_title[max(near, key=len)]
        if not texts:
            unmatched.append(f"{slug}: {name}")
            continue
        text = texts[0]
        # The last paragraph of a stretch can run into the table or heading that follows it: the
        # English description says how many sentences belong to it.
        wanted = len(sentences(english[k].replace("\n\n", " ")))
        if len(text) > 2 * len(english[k]) + 150:
            text = " ".join(sentences(text)[:wanted])
        current[k] = text
        added += 1
    ordered = {k: current[k] for k in english if k in current}
    if write:
        body = json.dumps(ordered, ensure_ascii=False, indent=2) + "\n"
        path.write_bytes(body.replace("\n", newline).encode("utf-8"))
    print(lang, "equipment descriptions", "added:" if write else "that would be added:", added)
    if unmatched:
        print(lang, "no paragraph for:", "; ".join(unmatched))


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    main(sys.argv[1], Path(sys.argv[2]), "--write" in sys.argv)
