"""Gives the pieces of equipment the tables could not pair their names in the official translation.

    python scripts/srd-translations/import_equipment.py it path/to/SRD_CC_v5.1_IT.pdf

`import_tables.py` pairs an item with its row in the PDF only when cost, weight and damage are
unique, and the book prints the names of a few things only in the text (the contents of a pack, the
background equipment). What is left is set here by hand, once: the SRD hardly changes. Every name
must be written in the PDF (a name in sentence case is compared without case and without the
punctuation that differs); the script lists the ones it does not find, which are either a typo or a
name written only here, and writes only keys that are still empty, so what the other scripts read is
never replaced. The barding is the armor's name after the word for barding.

Run it after `import_tables.py`.
"""

import json
import re
import sys
from pathlib import Path

from import_reference import ROOT, load_en

LANGS = ("it", "fr", "de", "es")

# slug: (it, fr, de, es)
MANUAL: dict[str, tuple[str, str, str, str]] = {
    # Weapons
    "mace": ("Mazza", "Masse d’armes", "Streitkolben", "Maza"),
    "dart": ("Dardo", "Fléchette", "Wurfpfeil", "Dardo"),
    "sling": ("Fionda", "Fronde", "Schleuder", "Honda"),
    "glaive": ("Falcione", "Coutille", "Glefe", "Guja"),
    "halberd": ("Alabarda", "Hallebarde", "Hellebarde", "Alabarda"),
    "trident": ("Tridente", "Trident", "Dreizack", "Tridente"),
    "blowgun": ("Cerbottana", "Sarbacane", "Blasrohr", "Cerbatana"),
    "net": ("Rete", "Filet", "Netz", "Red"),
    # Tools
    "alchemists-supplies": ("Scorte da alchimista", "Matériel d’alchimiste", "Alchemistenausrüstung", "Suministros de alquimista"),
    "brewers-supplies": ("Scorte da birraio", "Matériel de brasseur", "Brauereizubehör", "Suministros de cervecero"),
    "calligraphers-supplies": ("Scorte da calligrafo", "Matériel de calligraphe", "Kalligrafiewerkzeuge", "Suministros de calígrafo"),
    "carpenters-tools": ("Strumenti da falegname", "Outils de charpentier", "Schreinerwerkzeuge", "Herramientas de carpintero"),
    "cartographers-tools": ("Strumenti da cartografo", "Outils de cartographe", "Kartografenwerkzeuge", "Herramientas de cartógrafo"),
    "cobblers-tools": ("Strumenti da calzolaio", "Outils de cordonnier", "Schusterwerkzeuge", "Herramientas de zapatero"),
    "cooks-utensils": ("Utensili da cuoco", "Ustensiles de cuisinier", "Kochutensilien", "Útiles de cocinero"),
    "disguise-kit": ("Trucchi per il camuffamento", "Accessoires de déguisement", "Verkleidungsausrüstung", "Útiles para disfrazarse"),
    "forgery-kit": ("Arnesi da falsario", "Matériel de contrefaçon", "Fälscherausrüstung", "Útiles para falsificar"),
    "glassblowers-tools": ("Strumenti da soffiatore", "Outils de souffleur de verre", "Glasbläserwerkzeuge", "Herramientas de soplador de vidrio"),
    "jewelers-tools": ("Strumenti da gioielliere", "Outils de joaillier", "Juwelierwerkzeuge", "Herramientas de joyero"),
    "leatherworkers-tools": ("Strumenti da conciatore", "Outils de tanneur", "Ledererwerkzeuge", "Herramientas de curtidor"),
    "masons-tools": ("Strumenti da muratore", "Outils de maçon", "Maurerwerkzeuge", "Herramientas de albañil"),
    "painters-supplies": ("Strumenti da pittore", "Matériel de peintre", "Malereizubehör", "Suministros de pintor"),
    "poisoners-kit": ("Sostanze da avvelenatore", "Matériel d’empoisonneur", "Giftpaket", "Útiles de envenenador"),
    "potters-tools": ("Strumenti da vasaio", "Outils de potier", "Töpferwerkzeuge", "Herramientas de alfarero"),
    "smiths-tools": ("Strumenti da fabbro", "Outils de forgeron", "Schmiedewerkzeuge", "Herramientas de herrero"),
    "tinkers-tools": ("Strumenti da inventore", "Outils de bricoleur", "Tüftlerwerkzeuge", "Herramientas de manitas"),
    "weavers-tools": ("Strumenti da tessitore", "Outils de tisserand", "Weberwerkzeuge", "Herramientas de tejedor"),
    "woodcarvers-tools": ("Strumenti da intagliatore", "Outils de menuisier", "Holzschnitzwerkzeuge", "Herramientas de ebanista"),
    "dice-set": ("Dadi", "Dés", "Satz Würfel", "Dados"),
    "playing-card-set": ("Mazzo di carte", "Jeu de cartes", "Satz Spielkarten", "Naipes"),
    "flute": ("Flauto", "Flûte", "Flöte", "Flauta"),
    "shawm": ("Ciaramella", "Chalemie", "Schalmei", "Chirimía"),
    "navigators-tools": ("Strumenti da navigatore", "Instruments de navigateur", "Navigationswerkzeuge", "Herramientas de navegante"),
    "thieves-tools": ("Arnesi da scasso", "Outils de voleur", "Diebeswerkzeug", "Herramientas de ladrón"),
    "herbalism-kit": ("Borsa da erborista", "Matériel d’herboriste", "Kräuterkundeausrüstung", "Útiles de herborista"),
    "healers-kit": ("Borsa del guaritore", "Trousse de soins", "Heilerausrüstung", "Útiles de sanador"),
    # Mounts and vehicles
    "camel": ("Cammello", "Chameau", "Kamel", "Camello"),
    "donkey": ("Asino", "Âne", "Esel", "Burro"),
    "mule": ("Mulo", "Mule", "Maultier", "Mula"),
    "elephant": ("Elefante", "Éléphant", "Elefant", "Elefante"),
    "horse-draft": ("Cavallo da tiro", "Cheval de trait", "Zugpferd", "Caballo de tiro"),
    "horse-riding": ("Cavallo da galoppo", "Cheval de selle", "Reitpferd", "Caballo de monta"),
    "mastiff": ("Mastino", "Molosse", "Dogge", "Mastín"),
    "pony": ("Pony", "Poney", "Pony", "Poni"),
    "warhorse": ("Cavallo da guerra", "Destrier", "Streitross", "Caballo de guerra"),
    "bit-and-bridle": ("Morso e briglie", "Mors et bride", "Gebiss und Zaumzeug", "Bocado y bridas"),
    "saddle-exotic": ("Sella esotica", "Selle exotique", "Exotischer Sattel", "Silla exótica"),
    "stabling-1-day": ("Stalle (al giorno)", "Écuries (par jour)", "Stallmiete (pro Tag)", "Estabulado (por día)"),
    "longship": ("Nave lunga", "Drakkar", "Langschiff", "Drakkar"),
    "rowboat": ("Barca a remi", "Barque", "Ruderboot", "Bote de remos"),
    "sailing-ship": ("Nave a vela", "Bateau à voiles", "Segelschiff", "Velero"),
    # Adventuring gear
    "abacus": ("Abaco", "Boulier", "Abakus", "Ábaco"),
    "acid-vial": ("Acido (fiala)", "Acide (fiole)", "Säure (Phiole)", "Ácido (vial)"),
    "alms-box": ("Cassetta per le offerte", "Tronc à offrandes", "Klingelbeutel", "Caja para limosnas"),
    "antitoxin-vial": ("Antitossina (fiala)", "Antidote (fiole)", "Gegengift (Phiole)", "Antitoxina (vial)"),
    "arrow": ("Frecce (20)", "Flèches (20)", "Pfeile (20)", "Flechas (20)"),
    "backpack": ("Zaino", "Sac à dos", "Rucksack", "Mochila"),
    "ball-bearings-bag-of-1000": ("Sfere metalliche (sacchetto da 1.000)", "Billes (sac de 1 000)", "Metallkügelchen (Beutel mit 1.000)", "Bolas de metal (bolsa de 1000)"),
    "bell": ("Campanella", "Cloche", "Glocke", "Campana"),
    "blanket": ("Coperta", "Couverture", "Decke", "Manta"),
    "block-and-tackle": ("Carrucola e paranco", "Palan", "Flaschenzug", "Polipasto"),
    "block-of-incense": ("Cubetto di incenso", "Bloc d’encens", "Block Weihrauch", "Barra de incienso"),
    "blowgun-needle": ("Aghi da cerbottana (50)", "Dards de sarbacane (50)", "Blasrohrpfeile (50)", "Dardos de cerbatana (50)"),
    "bottle-glass": ("Bottiglia di vetro", "Bouteille, verre", "Flasche (Glas)", "Botella de cristal"),
    "bucket": ("Secchio", "Seau", "Eimer", "Cubo"),
    "caltrops": ("Triboli (sacchetto da 20)", "Chausse-trappes (sac de 20)", "Krähenfüße (Beutel mit 20)", "Abrojos (bolsa de 20)"),
    "candle": ("Candela", "Bougie", "Kerze", "Vela"),
    "case-crossbow-bolt": ("Custodia per quadrelli", "Étui pour carreaux d’arbalète", "Behälter (Armbrustbolzen)", "Estuche para virotes de ballesta"),
    "case-map-or-scroll": ("Custodia per mappe", "Étui à cartes ou à parchemins", "Behälter (Karte oder Schriftrolle)", "Estuche para mapa o pergamino"),
    "censer": ("Incensiere", "Encensoir", "Räuchergefäß", "Incensario"),
    "chalk-1-piece": ("Gessetto (1 pezzo)", "Craie (1 morceau)", "Kreide (1 Stück)", "Tiza (1 trozo)"),
    "chest": ("Forziere", "Coffre", "Truhe", "Cofre"),
    "clothes-common": ("Abito comune", "Vêtements ordinaires", "Kleidung, gewöhnlich", "Ropas comunes"),
    "clothes-costume": ("Abito, costume", "Costume", "Kleidung, Kostüm", "Ropas, disfraz"),
    "clothes-fine": ("Abito pregiato", "Vêtements de qualité", "Kleidung, fein", "Ropas de calidad"),
    "clothes-travelers": ("Abito da viaggiatore", "Tenue de voyage", "Kleidung, für Reise", "Ropas de viaje"),
    "component-pouch": ("Borsa per componenti", "Sacoche à composantes", "Materialkomponentenbeutel", "Saquito de componentes"),
    "crowbar": ("Piede di porco", "Pied-de-biche", "Brechstange", "Palanqueta"),
    "crystal": ("Cristallo", "Cristal", "Kristall", "Cristal"),
    "emblem": ("Emblema", "Emblème", "Emblem", "Emblema"),
    "fishing-tackle": ("Canna da pesca", "Matériel de pêche", "Angelausrüstung", "Caña de pescar"),
    "grappling-hook": ("Rampino", "Grappin", "Enterhaken", "Garfio de escalada"),
    "hammer": ("Martello", "Marteau", "Hammer", "Martillo"),
    "hammer-sledge": ("Martello da demolitore", "Masse", "Hammer (Vorschlaghammer)", "Mazo"),
    "holy-water-flask": ("Acqua santa (ampolla)", "Eau bénite (flasque)", "Weihwasser (Flasche)", "Agua bendita (frasco)"),
    "hourglass": ("Clessidra", "Sablier", "Sanduhr", "Reloj de arena"),
    "hunting-trap": ("Tagliola", "Piège à mâchoires", "Jagdfalle", "Trampa para cazar"),
    "ink-1-ounce-bottle": ("Inchiostro (boccetta da 30 ml)", "Encre (bouteille de 30 cl)", "Tinte (Flasche, 30 ml)", "Tinta (frasco de 30 ml)"),
    "ink-pen": ("Pennino", "Porte-plume", "Schreibfeder", "Pluma"),
    "lamp": ("Lampada", "Lampe", "Lampe", "Lámpara"),
    "lantern-bullseye": ("Lanterna a lente sporgente", "Lanterne sourde", "Laterne (Blendlaterne)", "Linterna de ojo de buey"),
    "lantern-hooded": ("Lanterna schermabile", "Lanterne à capote", "Laterne (abdeckbar)", "Linterna sorda"),
    "little-bag-of-sand": ("Sacchetto di sabbia", "Petit sac de sable", "Kleiner Beutel mit Sand", "Bolsita con arena"),
    "lock": ("Serratura", "Cadenas", "Schloss", "Cerradura"),
    "magnifying-glass": ("Lente d’ingrandimento", "Loupe", "Lupe", "Lupa"),
    "mirror-steel": ("Specchio di metallo", "Miroir en acier", "Stahlspiegel", "Espejito de acero"),
    "paper-one-sheet": ("Carta (un foglio)", "Papier (la feuille)", "Papier (ein Blatt)", "Papel (una hoja)"),
    "parchment-one-sheet": ("Pergamena (un foglio)", "Parchemin (la feuille)", "Pergament (ein Blatt)", "Pergamino (una hoja)"),
    "perfume-vial": ("Profumo (fiala)", "Parfum (flacon)", "Parfüm (Phiole)", "Perfume (un vial)"),
    "pick-miners": ("Piccone da minatore", "Pioche de mineur", "Spitzhacke", "Pico de minero"),
    "piton": ("Chiodo da rocciatore", "Piton", "Kletterhaken", "Pitón"),
    "poison-basic-vial": ("Veleno base (fiala)", "Poison standard (fiole)", "Gift (einfach, Phiole)", "Veneno básico (vial)"),
    "pot-iron": ("Pentola di ferro", "Pot en fer", "Topf (Eisen)", "Olla de hierro"),
    "pouch": ("Borsa", "Sacoche", "Beutel", "Bolsa"),
    "quiver": ("Faretra", "Carquois", "Köcher", "Aljaba"),
    "ram-portable": ("Ariete portatile", "Bélier portable", "Rammbock (tragbar)", "Ariete portátil"),
    "reliquary": ("Reliquiario", "Reliquaire", "Reliquie", "Relicario"),
    "robes": ("Veste", "Habit de cérémonie", "Robe", "Túnica"),
    "rod": ("Verga", "Sceptre", "Rute", "Vara"),
    "rope-silk-50-feet": ("Corda di seta (15 metri)", "Corde en soie (15 m)", "Seil, Seide (15 Meter)", "Cuerda de seda (15 m)"),
    "scale-merchants": ("Bilancia da mercante", "Balance de marchand", "Waage (Kaufmannswaage)", "Balanza de mercader"),
    "sealing-wax": ("Cera per sigillo", "Cire à cacheter", "Siegelwachs", "Lacre"),
    "shovel": ("Vanga o badile", "Pelle", "Schaufel", "Pala"),
    "signal-whistle": ("Fischietto da richiamo", "Sifflet", "Signalpfeife", "Silbato de supervivencia"),
    "signet-ring": ("Anello con sigillo", "Chevalière", "Siegelring", "Anillo de sellar"),
    "small-knife": ("Coltellino", "Petit couteau", "Kleines Messer", "Cuchillo pequeño"),
    "soap": ("Sapone", "Savon", "Seife", "Jabón"),
    "spike-iron": ("Spuntoni di ferro (10)", "Pointes en fer (10)", "Eisenstachel (10)", "Pinchos de hierro (10)"),
    "spyglass": ("Cannocchiale", "Longue-vue", "Fernglas", "Catalejo"),
    "staff": ("Bastone", "Bâton", "Stab", "Bastón"),
    "string-10-feet": ("Spago (3 metri)", "Ficelle (3 m)", "Schnur (3 Meter)", "Cordel (3 m)"),
    "sprig-of-mistletoe": ("Rametto di vischio", "Branche de houx", "Mistelzweig", "Rama de muérdago"),
    "tinderbox": ("Acciarino e pietra focaia", "Boîte à amadou", "Zunderkästchen", "Yesquero"),
    "torch": ("Torcia", "Torche", "Fackel", "Antorcha"),
    "totem": ("Totem", "Totem", "Totem", "Tótem"),
    "vestments": ("Vesti", "Habits liturgiques", "Gewand", "Vestiduras"),
    "vial": ("Fiala", "Fiole", "Phiole", "Vial"),
    "wand": ("Bacchetta", "Baguette", "Zauberstab", "Varita"),
    "waterskin": ("Otre", "Outre", "Wasserschlauch", "Cantimplora"),
    "whetstone": ("Cote per affilare", "Pierre à aiguiser", "Wetzstein", "Piedra de afilar"),
    "wooden-staff": ("Bastone di legno", "Bâton en bois", "Holzstab", "Bastón de madera"),
    "yew-wand": ("Bacchetta in legno di tasso", "Baguette d’if", "Zauberstab aus Eibe", "Varita de tejo"),
    # Packs
    "burglars-pack": ("Dotazione da scassinatore", "Paquetage de cambrioleur", "Einbrecherausrüstung", "Paquete de ladrón"),
    "diplomats-pack": ("Dotazione da diplomatico", "Paquetage de diplomate", "Diplomatenausrüstung", "Paquete de diplomático"),
    "dungeoneers-pack": ("Dotazione da avventuriero", "Paquetage d’exploration souterraine", "Gewölbeforscherausrüstung", "Paquete de explorador de mazmorras"),
    "entertainers-pack": ("Dotazione da intrattenitore", "Paquetage d’artiste", "Unterhaltungskünstler-Ausrüstung", "Paquete de artista"),
    "explorers-pack": ("Dotazione da esploratore", "Paquetage d’explorateur", "Entdeckerausrüstung", "Paquete de explorador"),
    "priests-pack": ("Dotazione da sacerdote", "Paquetage d’ecclésiastique", "Priesterausrüstung", "Paquete de sacerdote"),
    "scholars-pack": ("Dotazione da studioso", "Paquetage d’érudit", "Gelehrtenausrüstung", "Paquete de erudito"),
}

# The word for barding, then the slug of the armor whose name follows.
BARDING_WORD = {"it": "Bardatura: ", "fr": "Barde : ", "de": "Rossharnisch: ", "es": "Barda: "}
BARDING = {
    "barding-padded": "padded-armor",
    "barding-leather": "leather-armor",
    "barding-studded-leather": "studded-leather-armor",
    "barding-hide": "hide-armor",
    "barding-chain-shirt": "chain-shirt",
    "barding-scale-mail": "scale-mail",
    "barding-breastplate": "breastplate",
    "barding-half-plate": "half-plate-armor",
    "barding-ring-mail": "ring-mail",
    "barding-chain-mail": "chain-mail",
    "barding-splint": "splint-armor",
    "barding-plate": "plate-armor",
}


def flat(text: str) -> str:
    """Case, apostrophes, hyphenation and spaces set aside, to look a name up in the PDF text."""
    t = text.lower().replace("’", "'").replace("­", "")
    t = re.sub(r"-\s*\n\s*", "", t)  # a word broken at the end of a line
    t = re.sub(r"[\s ]+", " ", t)
    return t


def core(name: str) -> str:
    """The name without its parentheses and the comma that reverses it."""
    return re.sub(r"\s*\(.*$", "", name).strip()


def main(lang: str, pdf: Path) -> None:
    import pymupdf

    text = flat("\n".join(page.get_text() for page in pymupdf.open(pdf)))
    english = load_en("items")
    path = ROOT / "locales" / lang / "srd51" / "items.json"
    raw = path.read_bytes().decode("utf-8")
    newline = "\r\n" if "\r\n" in raw else "\n"  # the files keep their own line endings
    current = json.loads(raw)
    column = LANGS.index(lang)
    added = 0
    unseen: list[str] = []
    for slug, names in MANUAL.items():
        key = f"{slug}.name"
        if key not in english or current.get(key):
            continue
        name = names[column]
        if flat(core(name)) not in text and flat(name) not in text:
            unseen.append(f"{slug}: {name}")
        current[key] = name
        added += 1
    for slug, armor in BARDING.items():
        key = f"{slug}.name"
        armor_name = current.get(f"{armor}.name")
        if key in english and not current.get(key) and armor_name:
            current[key] = BARDING_WORD[lang] + armor_name
            added += 1
    ordered = {k: current[k] for k in english if k in current}
    body = json.dumps(ordered, ensure_ascii=False, indent=2) + "\n"
    path.write_bytes(body.replace("\n", newline).encode("utf-8"))
    print(lang, "equipment names added:", added)
    if unseen:
        print(lang, "not found in the PDF text (check, or written only here):")
        for line in unseen:
            print("   ", line)


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    main(sys.argv[1], Path(sys.argv[2]))
