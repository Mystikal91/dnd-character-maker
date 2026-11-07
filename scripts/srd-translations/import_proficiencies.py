"""Names the proficiencies of the SRD from what is already translated.

    python scripts/srd-translations/import_proficiencies.py it

A proficiency is the name of a thing the character can use: an armor, a weapon group, a tool, a
vehicle, a saving throw, a skill. The tools, instruments and kits have the slug of the item, so they
take the item's name; the skills and the saving throws take the skill and the ability names with the
word "skill" or "saving throw" in front; what is left (armor and weapon groups, the plural of each
weapon, the vehicles) is written here, once, since the SRD hardly changes.

Run it after `import_tables.py`, `import_equipment.py` and the skills and abilities imports. It
writes only keys still empty.
"""

import json
import sys
from pathlib import Path

from import_reference import ROOT, load_en

LANGS = ("it", "fr", "de", "es")

# slug: (it, fr, de, es)
GROUPS: dict[str, tuple[str, str, str, str]] = {
    "light-armor": ("Armature leggere", "Armures légères", "Leichte Rüstung", "Armaduras ligeras"),
    "medium-armor": ("Armature medie", "Armures intermédiaires", "Mittelschwere Rüstung", "Armaduras medias"),
    "heavy-armor": ("Armature pesanti", "Armures lourdes", "Schwere Rüstung", "Armaduras pesadas"),
    "all-armor": ("Tutte le armature", "Toutes les armures", "Alle Rüstungen", "Todas las armaduras"),
    "padded-armor": ("Armatura imbottita", "Armure matelassée", "Gepolsterte Rüstung", "Armadura acolchada"),
    "leather-armor": ("Armatura di cuoio", "Armure de cuir", "Lederrüstung", "Armadura de cuero"),
    "studded-leather-armor": ("Armatura di cuoio borchiato", "Armure de cuir clouté", "Beschlagene Lederrüstung", "Armadura de cuero tachonado"),
    "hide-armor": ("Armatura di pelle", "Armure de peaux", "Fellrüstung", "Armadura de pieles"),
    "shields": ("Scudi", "Boucliers", "Schilde", "Escudos"),
    "simple-weapons": ("Armi semplici", "Armes courantes", "Einfache Waffen", "Armas sencillas"),
    "martial-weapons": ("Armi da guerra", "Armes de guerre", "Kriegswaffen", "Armas marciales"),
    "land-vehicles": ("Veicoli terrestri", "Véhicules terrestres", "Landfahrzeuge", "Vehículos terrestres"),
    "water-vehicles": ("Veicoli acquatici", "Véhicules aquatiques", "Wasserfahrzeuge", "Vehículos acuáticos"),
}

# The plural of each weapon, in the order of the weapons of the SRD: (slug of the group, slug of the item).
WEAPONS = [
    ("clubs", "club"), ("daggers", "dagger"), ("greatclubs", "greatclub"), ("handaxes", "handaxe"),
    ("javelins", "javelin"), ("light-hammers", "light-hammer"), ("maces", "mace"), ("quarterstaffs", "quarterstaff"),
    ("sickles", "sickle"), ("spears", "spear"), ("crossbows-light", "crossbow-light"), ("darts", "dart"),
    ("shortbows", "shortbow"), ("slings", "sling"), ("battleaxes", "battleaxe"), ("flails", "flail"),
    ("glaives", "glaive"), ("greataxes", "greataxe"), ("greatswords", "greatsword"), ("halberds", "halberd"),
    ("lances", "lance"), ("longswords", "longsword"), ("mauls", "maul"), ("morningstars", "morningstar"),
    ("pikes", "pike"), ("rapiers", "rapier"), ("scimitars", "scimitar"), ("shortswords", "shortsword"),
    ("tridents", "trident"), ("war-picks", "war-pick"), ("warhammers", "warhammer"), ("whips", "whip"),
    ("blowguns", "blowgun"), ("hand-crossbows", "crossbow-hand"), ("crossbows-heavy", "crossbow-heavy"),
    ("longbows", "longbow"), ("nets", "net"),
]
PLURALS = {
    "it": ["Randelli", "Pugnali", "Randelli pesanti", "Asce", "Giavellotti", "Martelli leggeri", "Mazze", "Bastoni ferrati",
           "Falcetti", "Lance", "Balestre leggere", "Dardi", "Archi corti", "Fionde", "Asce da battaglia", "Mazzafrusti",
           "Falcioni", "Asce bipenni", "Spadoni", "Alabarde", "Lance da cavaliere", "Spade lunghe", "Magli", "Mazze chiodate",
           "Picche", "Stocchi", "Scimitarre", "Spade corte", "Tridenti", "Picconi da guerra", "Martelli da guerra", "Fruste",
           "Cerbottane", "Balestre a mano", "Balestre pesanti", "Archi lunghi", "Reti"],
    "fr": ["Gourdins", "Dagues", "Massues", "Hachettes", "Javelines", "Marteaux légers", "Masses d’armes", "Bâtons de combat",
           "Serpes", "Lances", "Arbalètes légères", "Fléchettes", "Arcs courts", "Frondes", "Haches d’armes", "Fléaux d’armes",
           "Coutilles", "Haches à deux mains", "Épées à deux mains", "Hallebardes", "Lances d’arçon", "Épées longues", "Maillets d’armes", "Morgensterns",
           "Piques", "Rapières", "Cimeterres", "Épées courtes", "Tridents", "Pics de guerre", "Marteaux de guerre", "Fouets",
           "Sarbacanes", "Arbalètes de poing", "Arbalètes lourdes", "Arcs longs", "Filets"],
    "de": ["Knüppel", "Dolche", "Zweihandknüppel", "Beile", "Wurfspeere", "Leichte Hämmer", "Streitkolben", "Kampfstäbe",
           "Sicheln", "Speere", "Leichte Armbrüste", "Wurfpfeile", "Kurzbögen", "Schleudern", "Streitäxte", "Flegel",
           "Glefen", "Zweihandäxte", "Zweihandschwerter", "Hellebarden", "Lanzen", "Langschwerter", "Zweihandhämmer", "Morgensterne",
           "Piken", "Rapiere", "Krummsäbel", "Kurzschwerter", "Dreizacke", "Kriegspicken", "Kriegshämmer", "Peitschen",
           "Blasrohre", "Handarmbrüste", "Schwere Armbrüste", "Langbögen", "Netze"],
    "es": ["Garrotes", "Dagas", "Garrotes grandes", "Hachas de mano", "Jabalinas", "Martillos ligeros", "Mazas", "Bastones",
           "Hoces", "Lanzas", "Ballestas ligeras", "Dardos", "Arcos cortos", "Hondas", "Hachas de guerra", "Manguales",
           "Gujas", "Hachas a dos manos", "Espadones", "Alabardas", "Lanzas de caballería", "Espadas largas", "Mazas a dos manos", "Luceros del alba",
           "Picas", "Estoques", "Cimitarras", "Espadas cortas", "Tridentes", "Picos de guerra", "Martillos de guerra", "Látigos",
           "Cerbatanas", "Ballestas de mano", "Ballestas pesadas", "Arcos largos", "Redes"],
}
SKILL_WORD = {"it": "Abilità", "fr": "Compétence", "de": "Fertigkeit", "es": "Habilidad"}
SAVE_WORD = {"it": "Tiro salvezza", "fr": "Jet de sauvegarde", "de": "Rettungswurf", "es": "Tirada de salvación"}


def load(lang: str, name: str) -> dict:
    return json.loads((ROOT / "locales" / lang / "srd51" / f"{name}.json").read_text(encoding="utf-8"))


def main(lang: str) -> None:
    column = LANGS.index(lang)
    english = load_en("proficiencies")
    items, skills, abilities = load(lang, "items"), load(lang, "skills"), load(lang, "abilities")
    out: dict[str, str] = {}
    for slug, names in GROUPS.items():
        out[f"{slug}.name"] = names[column]
    for (group, _), plural in zip(WEAPONS, PLURALS[lang]):
        out[f"{group}.name"] = plural
    # Armor of the SRD that is not listed above is a piece of armor with its own name.
    for key in english:
        slug = key[:-5]
        if key in out:
            continue
        if slug.startswith("saving-throw-"):
            ability = slug.removeprefix("saving-throw-")
            abbreviation = abilities.get(f"{ability}.abbreviation")
            if abbreviation:
                out[key] = f"{SAVE_WORD[lang]}: {abbreviation}"
        elif slug.startswith("skill-"):
            name = skills.get(f"{slug.removeprefix('skill-')}.name")
            if name:
                out[key] = f"{SKILL_WORD[lang]}: {name}"
        elif f"{slug}.name" in items:
            out[key] = items[f"{slug}.name"]
    path = ROOT / "locales" / lang / "srd51" / "proficiencies.json"
    raw = path.read_bytes().decode("utf-8")
    newline = "\r\n" if "\r\n" in raw else "\n"
    current = json.loads(raw)
    added = 0
    for key, value in out.items():
        if key in english and not current.get(key):
            current[key] = value
            added += 1
    ordered = {k: current[k] for k in english if k in current}
    body = json.dumps(ordered, ensure_ascii=False, indent=2) + "\n"
    path.write_bytes(body.replace("\n", newline).encode("utf-8"))
    missing = [k for k in english if k not in ordered]
    print(lang, "proficiency names added:", added, "of", len(english), "still missing:", missing)


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    for lang in sys.argv[1:]:
        main(lang)
