"""Names the variants of magic items (+1 weapons, potions of giant strength, ioun stones...).

    python scripts/srd-translations/import_item_variants.py it path/to/SRD_CC_v5.1_IT.pdf [--write]

The PDF prints one section for a whole family ("Belt of Giant Strength") and the English data has
one entry for each variant, so no section pairs with them. Their names are built here: the family
name the book uses, then the words the book uses for the variant (the giant, the metal, the
element...), put together the way the language writes them. Every word is looked up in the PDF
text, and the ones it does not find are listed so that they can be fixed by hand. The damage types
come from the interface texts (`hb.o.*`), which the person already sees everywhere else.

Only the names are built. The descriptions of the variants stay in English for now (the app
translates them on demand); the text of the family is in the book under the family's name.

Run it after `import_magic_items.py` and `import_equipment.py`. Without `--write` it only reports; with it, it writes only keys still empty.
"""

import json
import re
import sys
from pathlib import Path

from import_reference import ROOT, load_en

LANGS = ("it", "fr", "de", "es")
DAMAGE = ("acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder")
GIANTS = ("hill", "stone", "frost", "fire", "cloud", "storm")
ELEMENTS = ("air", "earth", "fire", "water")
DRAGONS = ("black", "blue", "brass", "bronze", "copper", "gold", "green", "red", "silver", "white")
METALS = ("silver", "brass", "bronze", "iron")
GOLEMS = ("clay", "flesh", "iron", "stone")
FEATHERS = ("anchor", "bird", "fan", "swan-boat", "tree", "whip")
FIGURINES = ("bronze-griffon", "ebony-fly", "golden-lions", "ivory-goats", "marble-elephant", "obsidian-steed", "onyx-dog", "serpentine-owl", "silver-raven")
IOUN = ("absorption", "agility", "awareness", "fortitude", "greater-absorption", "insight", "intellect", "leadership", "mastery", "protection", "regeneration", "reserve", "strength", "sustenance")
CRYSTAL = ("mind-reading", "telepathy", "true-seeing")
BAGS = ("gray", "rust", "tan")
CARPETS = ("3x5", "4x6", "5x7", "6x9")
HEALING = ("common", "greater", "superior", "supreme")
SCROLLS = ("cantrip", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th")
SIZES = ("90 × 150 cm", "120 × 180 cm", "150 × 210 cm", "180 × 270 cm")

# Per language. Lists follow the order of the constants above. "{}" is where the variant goes.
V: dict[str, dict] = {
    "it": {
        "plus": {"ammunition": "Munizioni, +{}", "armor": "Armatura, +{}", "weapon": "Arma, +{}", "wand-of-the-war-mage": "Bacchetta del mago da guerra, +{}"},
        "bag": "Borsa dei trucchi {}", "bags": ("grigia", "ruggine", "marrone"),
        "belt": "Cintura della forza dei giganti {}", "potion-giant": "Pozione della forza dei giganti {}",
        "giants": ("delle colline", "delle pietre", "del gelo", "del fuoco", "delle nuvole", "delle tempeste"),
        "carpet": "Tappeto volante ({})",
        "crystal": ("Sfera di cristallo della lettura del pensiero", "Sfera di cristallo della telepatia", "Sfera di cristallo della visione del vero"),
        "dragon": "Corazza di scaglie di drago {}", "dragons": ("nero", "blu", "d’ottone", "di bronzo", "di rame", "d’oro", "verde", "rosso", "d’argento", "bianco"),
        "gem": "Gemma elementale ({})", "elements": ("aria", "terra", "fuoco", "acqua"),
        "feather": "Piuma magica ({})", "feathers": ("ancora", "uccello", "ventaglio", "barca cigno", "albero", "frusta"),
        "figurine": "Statuina del potere meraviglioso ({})",
        "figurines": ("Grifone di bronzo", "Mosca d’ebano", "Leoni d’oro", "Capre d’avorio", "Elefante di marmo", "Stallone di ossidiana", "Cane di onice", "Gufo di serpentino", "Corvo d’argento"),
        "horn": "Corno del Valhalla ({})", "metals": ("argento", "ottone", "bronzo", "ferro"),
        "ioun": "Pietra di Ioun ({})",
        "iouns": ("Assorbimento", "Agilità", "Consapevolezza", "Tempra", "Assorbimento superiore", "Intuizione", "Intelletto", "Autorità", "Maestria", "Protezione", "Rigenerazione", "Riserva", "Forza", "Sostentamento"),
        "golem": "Manuale dei golem ({})", "golems": ("argilla", "carne", "ferro", "pietra"),
        "healing": ("Pozione di guarigione", "Pozione di guarigione maggiore", "Pozione di guarigione superiore", "Pozione di guarigione suprema"),
        "potion-res": "Pozione di resistenza ({})", "ring-res": "Anello di resistenza ({})",
        "ring-elem": "Anello del comando degli elementali ({})",
        "scroll": "Pergamena magica ({})", "scrolls": ("trucchetto", "1° livello", "2° livello", "3° livello", "4° livello", "5° livello", "6° livello", "7° livello", "8° livello", "9° livello"),
        "orb": "Sfera della stirpe dei draghi",
    },
    "fr": {
        "plus": {"ammunition": "Munitions, +{}", "armor": "Armure, +{}", "weapon": "Arme, +{}", "wand-of-the-war-mage": "Baguette du mage de guerre, +{}"},
        "bag": "Sac à malices {}", "bags": ("gris", "rouille", "brun"),
        "belt": "Ceinturon de force de géant {}", "potion-giant": "Potion de force de géant {}",
        "giants": ("des collines", "des pierres", "du givre", "du feu", "des nuages", "des tempêtes"),
        "carpet": "Tapis volant ({})",
        "crystal": ("Boule de cristal de lecture des pensées", "Boule de cristal de télépathie", "Boule de cristal de vision suprême"),
        "dragon": "Armure d’écailles de dragon {}", "dragons": ("noir", "bleu", "d’airain", "de bronze", "de cuivre", "d’or", "vert", "rouge", "d’argent", "blanc"),
        "gem": "Gemme élémentaire ({})", "elements": ("air", "terre", "feu", "eau"),
        "feather": "Plume magique ({})", "feathers": ("ancre", "oiseau", "éventail", "bateau-cygne", "arbre", "fouet"),
        "figurine": "Figurine merveilleuse ({})",
        "figurines": ("Griffon de bronze", "Mouche d’ébène", "Lions d’or", "Chèvres d’ivoire", "Éléphant de marbre", "Destrier d’obsidienne", "Chien d’onyx", "Chouette de serpentine", "Corbeau d’argent"),
        "horn": "Cor du Valhalla ({})", "metals": ("argent", "airain", "bronze", "fer"),
        "ioun": "Pierre d’Ioun ({})",
        "iouns": ("Absorption", "Agilité", "Vigilance", "Vigueur", "Absorption suprême", "Intuition", "Intellect", "Commandement", "Maîtrise", "Protection", "Régénération", "Réserve", "Force", "Subsistance"),
        "golem": "Manuel des golems ({})", "golems": ("argile", "chair", "fer", "pierre"),
        "healing": ("Potion de guérison", "Potion de guérison importante", "Potion de guérison supérieure", "Potion de guérison suprême"),
        "potion-res": "Potion de résistance ({})", "ring-res": "Anneau de résistance ({})",
        "ring-elem": "Anneau de maîtrise élémentaire ({})",
        "scroll": "Parchemin de sort ({})", "scrolls": ("sort mineur", "niveau 1", "niveau 2", "niveau 3", "niveau 4", "niveau 5", "niveau 6", "niveau 7", "niveau 8", "niveau 9"),
        "orb": "Orbe des dragons",
    },
    "de": {
        "plus": {"ammunition": "Munition, +{}", "armor": "Rüstung, +{}", "weapon": "Waffe, +{}", "wand-of-the-war-mage": "Zauberstab des Kriegsmagiers, +{}"},
        "bag": "Trickbeutel ({})", "bags": ("grau", "rostfarben", "beigefarben"),
        "belt": "Gürtel der {}", "potion-giant": "Trank der {}",
        "giants": ("Hügelriesenstärke", "Steinriesenstärke", "Frostriesenstärke", "Feuerriesenstärke", "Wolkenriesenstärke", "Sturmriesenstärke"),
        "carpet": "Fliegender Teppich ({})",
        "crystal": ("Kristallkugel des Gedankenlesens", "Kristallkugel der Telepathie", "Kristallkugel des Wahren Blicks"),
        "dragon": "Drachenschuppenpanzer ({})", "dragons": ("Schwarz", "Blau", "Messing", "Bronze", "Kupfer", "Gold", "Grün", "Rot", "Silber", "Weiß"),
        "gem": "Elementarer Edelstein ({})", "elements": ("Luft", "Erde", "Feuer", "Wasser"),
        "feather": "Federfigur ({})", "feathers": ("Anker", "Vogel", "Fächer", "Schwanenboot", "Baum", "Peitsche"),
        "figurine": "Figur der wundersamen Kraft ({})",
        "figurines": ("Bronze-Greif", "Ebenholz-Fliege", "Goldene Löwen", "Elfenbein-Ziegen", "Marmor-Elefant", "Obsidianpferd", "Onyx-Hund", "Serpentin-Eule", "Silber-Rabe"),
        "horn": "Horn von Walhalla ({})", "metals": ("Silber", "Messing", "Bronze", "Eisen"),
        "ioun": "Ioun-Stein ({})",
        "iouns": ("Absorption", "Agilität", "Wahrnehmung", "Standhaftigkeit", "Höhere Absorption", "Erkenntnis", "Verstand", "Führungskraft", "Meisterschaft", "Schutz", "Regeneration", "Reserve", "Stärke", "Ernährung"),
        "golem": "Handbuch der Golems ({})", "golems": ("Ton", "Fleisch", "Eisen", "Stein"),
        "healing": ("Heiltrank", "Trank der Mächtigen Heilung", "Trank der Überlegenen Heilung", "Trank der Höchsten Heilung"),
        "potion-res": "Trank des Widerstands ({})", "ring-res": "Ring des Widerstands ({})",
        "ring-elem": "Ring der Elementar-Herrschaft ({})",
        "scroll": "Zauberschriftrolle ({})", "scrolls": ("Zaubertrick", "1. Grad", "2. Grad", "3. Grad", "4. Grad", "5. Grad", "6. Grad", "7. Grad", "8. Grad", "9. Grad"),
        "orb": "Kugel der Drachen",
    },
    "es": {
        "plus": {"ammunition": "Munición, +{}", "armor": "Armadura, +{}", "weapon": "Arma, +{}", "wand-of-the-war-mage": "Varita del mago de guerra, +{}"},
        "bag": "Bolsa de trucos {}", "bags": ("gris", "rojiza", "marrón"),
        "belt": "Cinturón de fuerza de gigante {}", "potion-giant": "Poción de fuerza de gigante {}",
        "giants": ("de las colinas", "de piedra", "de escarcha", "de fuego", "de las nubes", "de la tormenta"),
        "carpet": "Alfombra voladora ({})",
        "crystal": ("Bola de cristal de leer mentes", "Bola de cristal de telepatía", "Bola de cristal de visión veraz"),
        "dragon": "Armadura de escamas de dragón {}", "dragons": ("negro", "azul", "de latón", "de bronce", "de cobre", "de oro", "verde", "rojo", "de plata", "blanco"),
        "gem": "Gema elemental ({})", "elements": ("aire", "tierra", "fuego", "agua"),
        "feather": "Pluma mágica ({})", "feathers": ("ancla", "pájaro", "abanico", "bote cisne", "árbol", "látigo"),
        "figurine": "Estatuilla de poder maravilloso ({})",
        "figurines": ("Grifo de bronce", "Mosca de ébano", "Leones dorados", "Cabras de marfil", "Elefante de mármol", "Corcel de obsidiana", "Perro de ónice", "Búho de serpentina", "Cuervo de plata"),
        "horn": "Cuerno del Valhalla ({})", "metals": ("plata", "latón", "bronce", "hierro"),
        "ioun": "Piedra de Ioun ({})",
        "iouns": ("Absorción", "Agilidad", "Consciencia", "Fortaleza", "Absorción mayor", "Perspicacia", "Intelecto", "Liderazgo", "Maestría", "Protección", "Regeneración", "Reserva", "Fuerza", "Sustento"),
        "golem": "Manual de gólems ({})", "golems": ("arcilla", "carne", "hierro", "piedra"),
        "healing": ("Poción de curación", "Poción de curación mayor", "Poción de curación superior", "Poción de curación suprema"),
        "potion-res": "Poción de resistencia ({})", "ring-res": "Anillo de resistencia ({})",
        "ring-elem": "Anillo de comandar elementales ({})",
        "scroll": "Pergamino de conjuro ({})", "scrolls": ("truco", "nivel 1", "nivel 2", "nivel 3", "nivel 4", "nivel 5", "nivel 6", "nivel 7", "nivel 8", "nivel 9"),
        "orb": "Orbe de los Dragones",
    },
}


def build(lang: str, damage: dict[str, str]) -> tuple[dict[str, str], list[str]]:
    """slug -> name, and the words to look up in the PDF."""
    v = V[lang]
    out: dict[str, str] = {}
    words: list[str] = []

    def put(slug: str, template: str, word: str | None = None, look: bool = True) -> None:
        out[slug] = template.replace("{}", word) if word is not None else template
        if look:
            words.append(word if word is not None else template)

    for family, template in v["plus"].items():
        for n in (1, 2, 3):
            put(f"{family}-{n}" if family != "wand-of-the-war-mage" else f"wand-of-the-war-mage-{n}", template, str(n), look=False)
        words.append(re.sub(r",? ?\+?\{\}$", "", template))
    for slug, w in zip(BAGS, v["bags"]):
        put(f"bag-of-tricks-{slug}", v["bag"], w)
    for slug, w in zip(GIANTS, v["giants"]):
        put(f"belt-of-giant-strength-{slug}", v["belt"], w)
        put(f"potion-of-giant-strength-{slug}", v["potion-giant"], w)
    for slug, w in zip(CARPETS, SIZES):
        put(f"carpet-of-flying-{slug}", v["carpet"], w, look=False)
    for slug, name in zip(CRYSTAL, v["crystal"]):
        put(f"crystal-ball-of-{slug}", name)
    for slug, w in zip(DRAGONS, v["dragons"]):
        put(f"dragon-scale-mail-{slug}", v["dragon"], w, look=False)
    for slug, w in zip(ELEMENTS, v["elements"]):
        put(f"elemental-gem-{slug}", v["gem"], w)
        put(f"ring-of-elemental-command-{slug}", v["ring-elem"], w, look=False)
    for slug, w in zip(FEATHERS, v["feathers"]):
        put(f"feather-token-{slug}", v["feather"], w)
    for slug, w in zip(FIGURINES, v["figurines"]):
        put(f"figurine-of-wondrous-power-{slug}", v["figurine"], w)
    for slug, w in zip(METALS, v["metals"]):
        put(f"horn-of-valhalla-{slug}", v["horn"], w)
    for slug, w in zip(IOUN, v["iouns"]):
        put(f"ioun-stone-of-{slug}", v["ioun"], w)
    for slug, w in zip(GOLEMS, v["golems"]):
        put(f"manual-of-golems-{slug}", v["golem"], w)
    for slug, name in zip(HEALING, v["healing"]):
        put(f"potion-of-healing-{slug}", name)
    for slug in DAMAGE:
        put(f"potion-of-resistance-{slug}", v["potion-res"], damage[slug], look=False)
        put(f"ring-of-resistance-{slug}", v["ring-res"], damage[slug], look=False)
    for slug, w in zip(SCROLLS, v["scrolls"]):
        put(f"spell-scroll-{slug}", v["scroll"], w, look=False)
    put("orb-of-dragonkind", v["orb"])
    return out, words


def flat(text: str) -> str:
    t = text.lower().replace("’", "'").replace("­", "")
    t = re.sub(r"-\s*\n\s*", "", t)
    return re.sub(r"[\s ]+", " ", t)


def main(lang: str, pdf: Path) -> None:
    import pymupdf

    text = flat("\n".join(page.get_text() for page in pymupdf.open(pdf)))
    ui = json.loads((ROOT / "locales" / lang / "ui.json").read_text(encoding="utf-8"))
    damage = {d: (ui[f"hb.o.{d}"] if lang == "de" else ui[f"hb.o.{d}"].lower()) for d in DAMAGE}
    names, words = build(lang, damage)
    english = load_en("items")
    path = ROOT / "locales" / lang / "srd51" / "items.json"
    raw = path.read_bytes().decode("utf-8")
    newline = "\r\n" if "\r\n" in raw else "\n"
    current = json.loads(raw)
    added = 0
    for slug, name in names.items():
        key = f"{slug}.name"
        if key in english and not current.get(key):
            current[key] = name
            added += 1
    ordered = {k: current[k] for k in english if k in current}
    body = json.dumps(ordered, ensure_ascii=False, indent=2) + "\n"
    if "--write" in sys.argv:
        path.write_bytes(body.replace("\n", newline).encode("utf-8"))
    print(lang, "variant names", "added:" if "--write" in sys.argv else "that would be added:", added, "of", len(names))
    missing = sorted({w for w in words if flat(w) not in text})
    if missing:
        print(lang, "words not found in the PDF text (check):")
        for w in missing:
            print("   ", w)


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    main(sys.argv[1], Path(sys.argv[2]))
