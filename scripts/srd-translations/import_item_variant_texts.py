"""Writes the descriptions of the variants of magic items (+1 weapons, belts of giant strength...).

    python scripts/srd-translations/import_item_variant_texts.py it path/to/SRD_CC_v5.1_IT.pdf [--write]

The book has one section for a whole family and the English data has one text for each variant, so
the texts are built in two ways:

* Families that differ by a number or a word (the +1 to +3 weapons, belts, potions, rings of
  resistance, carpets, horns, golem manuals, spell scrolls, dragon scale mail, elemental gems) have
  a template here, written once for each language from the book's wording, with the numbers
  filled in from the English text.
* Families that have a paragraph for each variant in the book (ioun stones, feather tokens, the
  crystal balls) take that paragraph from the PDF, after a shared introduction.

The first line (the kind of item, the rarity, the attunement) is the one other items of the same
kind already have in the language, or one of the lines written below. Figurines, bags of tricks,
rings of elemental command and the Orb of Dragonkind are not done: they carry stat blocks or tables.
Without `--write` it only reports; with it, it writes only keys that are still empty.
"""

import json
import re
import sys
from pathlib import Path

from import_equipment_texts import FOOTER, sentences
from import_reference import ROOT, key, load_en
from import_spells import LANGUAGES, pdf_lines

LANGS = ("it", "fr", "de", "es")

# First lines the translated items do not have yet: English line -> (it, fr, de, es).
HEADERS: dict[str, tuple[str, str, str, str]] = {
    "Weapon (any ammunition), uncommon": ("Arma (qualsiasi munizione), non comune", "Arme (munition quelconque), peu courante", "Waffe (beliebige Munition), ungewöhnlich", "Arma (cualquier munición), infrecuente"),
    "Weapon (any ammunition), rare": ("Arma (qualsiasi munizione), rara", "Arme (munition quelconque), rare", "Waffe (beliebige Munition), selten", "Arma (cualquier munición), rara"),
    "Weapon (any ammunition), very rare": ("Arma (qualsiasi munizione), molto rara", "Arme (munition quelconque), très rare", "Waffe (beliebige Munition), sehr selten", "Arma (cualquier munición), muy rara"),
    "Armor (light, medium, or heavy), rare": ("Armatura (leggera, media o pesante), rara", "Armure (légère, intermédiaire ou lourde), rare", "Rüstung (leicht, mittelschwer oder schwer), selten", "Armadura (ligera, media o pesada), rara"),
    "Armor (light, medium, or heavy), very rare": ("Armatura (leggera, media o pesante), molto rara", "Armure (légère, intermédiaire ou lourde), très rare", "Rüstung (leicht, mittelschwer oder schwer), sehr selten", "Armadura (ligera, media o pesada), muy rara"),
    "Armor (light, medium, or heavy), legendary": ("Armatura (leggera, media o pesante), leggendaria", "Armure (légère, intermédiaire ou lourde), légendaire", "Rüstung (leicht, mittelschwer oder schwer), legendär", "Armadura (ligera, media o pesada), legendaria"),
    "Armor (scale mail), very rare (requires attunement)": ("Armatura (corazza a scaglie), molto rara (richiede sintonia)", "Armure (écailles), très rare (harmonisation requise)", "Rüstung (Schuppenpanzer), sehr selten (erfordert Einstimmung)", "Armadura (cota de escamas), muy rara (requiere sintonización)"),
    "Potion, legendary": ("Pozione, leggendaria", "Potion, légendaire", "Trank, legendär", "Poción, legendaria"),
    "Scroll, common": ("Pergamena, comune", "Parchemin, courant", "Schriftrolle, gewöhnlich", "Pergamino, común"),
    "Scroll, uncommon": ("Pergamena, non comune", "Parchemin, peu courant", "Schriftrolle, ungewöhnlich", "Pergamino, infrecuente"),
    "Scroll, rare": ("Pergamena, rara", "Parchemin, rare", "Schriftrolle, selten", "Pergamino, raro"),
    "Scroll, very rare": ("Pergamena, molto rara", "Parchemin, très rare", "Schriftrolle, sehr selten", "Pergamino, muy raro"),
    "Scroll, legendary": ("Pergamena, leggendaria", "Parchemin, légendaire", "Schriftrolle, legendär", "Pergamino, legendario"),
    "Weapon (any), uncommon": ("Arma (qualsiasi), non comune", "Arme (quelconque), peu courante", "Waffe (beliebig), ungewöhnlich", "Arma (cualquiera), infrecuente"),
    "Wondrous item, artifact (requires attunement)": ("Oggetto meraviglioso, manufatto (richiede sintonia)", "Objet merveilleux, artefact (harmonisation requise)", "Wundersamer Gegenstand, Artefakt (erfordert Einstimmung)", "Objeto maravilloso, artefacto (requiere sintonización)"),
    "Weapon (any), very rare": ("Arma (qualsiasi), molto rara", "Arme (quelconque), très rare", "Waffe (beliebig), sehr selten", "Arma (cualquiera), muy rara"),
}

# Words by damage type: the phrase that follows "resistance to ... damage" (it, fr, de, es lists).
DAMAGE = ("acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder")
RESIST = {
    "it": ["da acido", "da freddo", "da fuoco", "da forza", "da fulmine", "necrotici", "da veleno", "psichici", "radiosi", "da tuono"],
    "fr": ["d’acide", "de froid", "de feu", "de force", "de foudre", "nécrotiques", "de poison", "psychiques", "radiants", "de tonnerre"],
    "de": ["Säureschaden", "Kälteschaden", "Feuerschaden", "Energieschaden", "Blitzschaden", "nekrotischen Schaden", "Giftschaden", "psychischen Schaden", "gleißenden Schaden", "Donnerschaden"],
    "es": ["de ácido", "de frío", "de fuego", "de fuerza", "de relámpago", "necrótico", "de veneno", "psíquico", "radiante", "de trueno"],
}
RING_GEMS = {  # pearl, tourmaline, garnet, sapphire, citrine, jet, amethyst, jade, topaz, spinel
    "it": ["perla", "tormalina", "granato", "zaffiro", "citrino", "giaietto", "ametista", "giada", "topazio", "spinello"],
    "fr": ["perle", "tourmaline", "grenat", "saphir", "citrine", "jais", "améthyste", "jade", "topaze", "spinelle"],
    "de": ["Perlen", "Turmalin", "Granat", "Saphir", "Citrin", "Gagat", "Amethyst", "Jade", "Topas", "Spinell"],
    "es": ["perla", "turmalina", "granate", "zafiro", "citrino", "azabache", "amatista", "jade", "topacio", "espinela"],
}
GIANTS = ("hill", "stone", "frost", "fire", "cloud", "storm")
GIANT_FORCE = {"hill": 21, "stone": 23, "frost": 23, "fire": 25, "cloud": 27, "storm": 29}
GIANT_OF = {  # "of a ... giant", after the word for giant
    "it": ["delle colline", "delle pietre", "del gelo", "del fuoco", "delle nuvole", "delle tempeste"],
    "fr": ["des collines", "des pierres", "du givre", "du feu", "des nuages", "des tempêtes"],
    "de": ["Hügelriesen", "Steinriesen", "Frostriesen", "Feuerriesen", "Wolkenriesen", "Sturmriesen"],
    "es": ["de las colinas", "de piedra", "de escarcha", "de fuego", "de las nubes", "de la tormenta"],
}
HEALING = {"common": "2d4 + 2", "greater": "4d4 + 4", "superior": "8d4 + 8", "supreme": "10d4 + 20"}

# {n}, {dice}... are filled in; every template is (it, fr, de, es). "\n\n" separates paragraphs.
T: dict[str, tuple[str, str, str, str]] = {
    "ammunition": (
        "Il personaggio ottiene un bonus di +{n} ai tiri per colpire e ai tiri per i danni effettuati con questa munizione magica. Una volta che ha colpito un bersaglio, la munizione non è più magica.",
        "Vous bénéficiez d’un bonus de +{n} aux jets d’attaque et de dégâts effectués avec cette munition magique. Une fois qu’elle a touché une cible, la munition n’est plus magique.",
        "Du erhältst einen Bonus von +{n} auf Angriffs- und Schadenswürfe, die du mit dieser magischen Munition ausführst. Sobald sie ein Ziel getroffen hat, ist die Munition nicht mehr magisch.",
        "Obtienes un bonificador de +{n} a las tiradas de ataque y de daño realizadas con esta munición mágica. Una vez que alcanza un objetivo, la munición deja de ser mágica."),
    "armor": (
        "Finché indossa questa armatura, il personaggio ottiene un bonus di +{n} alla CA.",
        "Vous bénéficiez d’un bonus de +{n} à la CA tant que vous portez cette armure.",
        "Du erhältst einen Bonus von +{n} auf deine RK, solange du diese Rüstung trägst.",
        "Obtienes un bonificador de +{n} a la CA mientras lleves puesta esta armadura."),
    "weapon": (
        "Il personaggio ottiene un bonus di +{n} ai tiri per colpire e ai tiri per i danni effettuati con quest’arma magica.",
        "Vous bénéficiez d’un bonus de +{n} aux jets d’attaque et de dégâts effectués avec cette arme magique.",
        "Du erhältst einen Bonus von +{n} auf Angriffs- und Schadenswürfe, die du mit dieser magischen Waffe ausführst.",
        "Obtienes un bonificador de +{n} a las tiradas de ataque y de daño realizadas con esta arma mágica."),
    "wand": (
        "Finché impugna questa bacchetta, il personaggio ottiene un bonus di +{n} ai tiri per colpire con gli incantesimi. Inoltre ignora la copertura parziale quando effettua un attacco con un incantesimo.",
        "Tant que vous tenez cette baguette, vous bénéficiez d’un bonus de +{n} aux jets d’attaque de sort. De plus, vous ignorez l’abri partiel lorsque vous effectuez une attaque de sort.",
        "Solange du diesen Zauberstab hältst, erhältst du einen Bonus von +{n} auf Zauberangriffswürfe. Außerdem ignorierst du halbe Deckung, wenn du einen Zauberangriff ausführst.",
        "Mientras sostengas esta varita, obtienes un bonificador de +{n} a las tiradas de ataque de conjuro. Además, ignoras la cobertura media cuando realizas un ataque de conjuro."),
    "belt": (
        "Mentre indossa questa cintura, il punteggio di Forza del personaggio diventa {n}. Se il suo punteggio di Forza è già pari o superiore a quello della cintura, l’oggetto non ha alcun effetto.",
        "Tant que vous portez cette ceinture, votre valeur de Force devient {n}. Si votre valeur de Force est déjà égale ou supérieure à celle de la ceinture, l’objet n’a aucun effet sur vous.",
        "Solange du diesen Gürtel trägst, ändert sich dein Stärkewert auf {n}. Falls deine Stärke bereits dem Wert des Gürtels entspricht oder höher ist, hat der Gegenstand keine Wirkung auf dich.",
        "Mientras lleves este cinturón, tu puntuación de Fuerza pasa a ser {n}. Si tu Fuerza ya es igual o superior a la del cinturón, el objeto no tiene efecto sobre ti."),
    "potion-giant": (
        "Quando il personaggio beve questa pozione, il suo punteggio di Forza diventa {n} per 1 ora. La pozione non ha alcun effetto se il suo punteggio di Forza è pari o superiore a quel valore.\n\nNel liquido trasparente di questa pozione galleggia un frammento di unghia di un gigante {giant}.",
        "Lorsque vous buvez cette potion, votre valeur de Force devient {n} pendant 1 heure. La potion n’a aucun effet sur vous si votre valeur de Force est égale ou supérieure à ce score.\n\nUn éclat d’ongle de géant {giant} flotte dans le liquide transparent de cette potion.",
        "Wenn du diesen Trank trinkst, ändert sich dein Stärkewert 1 Stunde lang auf {n}. Der Trank hat keine Wirkung auf dich, falls deine Stärke gleich oder höher als dieser Wert ist.\n\nIn der durchsichtigen Flüssigkeit dieses Tranks schwimmt ein Stück Fingernagel eines {giant}.",
        "Cuando bebes esta poción, tu puntuación de Fuerza pasa a ser {n} durante 1 hora. La poción no tiene efecto sobre ti si tu Fuerza es igual o superior a esa puntuación.\n\nEn el líquido transparente de esta poción flota un trocito de uña de un gigante {giant}."),
    "potion-healing": (
        "Quando beve questa pozione, il personaggio recupera {dice} punti ferita. Il liquido rosso della pozione brilla quando viene agitato.",
        "Vous récupérez {dice} points de vie en buvant cette potion. Le liquide rouge de la potion étincelle lorsqu’on l’agite.",
        "Wenn du diesen Trank trinkst, erhältst du {dice} Trefferpunkte zurück. Die rote Flüssigkeit des Tranks schimmert, wenn sie bewegt wird.",
        "Cuando bebes esta poción, recuperas {dice} puntos de golpe. El líquido rojo de la poción brilla al agitarse."),
    "potion-resistance": (
        "Quando il personaggio beve questa pozione, ottiene resistenza ai danni {dmg} per 1 ora.",
        "Lorsque vous buvez cette potion, vous obtenez la résistance aux dégâts {dmg} pendant 1 heure.",
        "Wenn du diesen Trank trinkst, erhältst du 1 Stunde lang Resistenz gegen {dmg}.",
        "Cuando bebes esta poción, obtienes resistencia al daño {dmg} durante 1 hora."),
    "ring-resistance": (
        "Finché indossa questo anello di {gem}, il personaggio ha resistenza ai danni {dmg}.",
        "Tant que vous portez cet anneau de {gem}, vous avez la résistance aux dégâts {dmg}.",
        "Solange du diesen {gem}ring trägst, besitzt du Resistenz gegen {dmg}.",
        "Mientras lleves este anillo de {gem}, tienes resistencia al daño {dmg}."),
    "carpet": (
        "Il personaggio può pronunciare la parola d’ordine del tappeto con un’azione per farlo fluttuare e volare. Il tappeto si muove in base ai comandi verbali impartiti dal personaggio, che deve trovarsi entro 9 metri da esso.\n\nQuesto tappeto misura {size} e ha una velocità di volare di {s} metri. Può trasportare fino a {w} kg, ma la sua velocità di volare diventa {s2} metri se trasporta più di {w2} kg.",
        "Vous pouvez prononcer le mot de commande du tapis, au prix d’une action, pour le faire flotter et voler. Il se déplace selon vos instructions orales, tant que vous vous trouvez à 9 m ou moins de lui.\n\nCe tapis mesure {size} et possède une vitesse de vol de {s} m. Il peut transporter jusqu’à {w} kg, mais sa vitesse de vol passe à {s2} m s’il transporte plus de {w2} kg.",
        "Du kannst als Aktion das Befehlswort des Teppichs sprechen, damit er schwebt und fliegt. Er bewegt sich nach deinen gesprochenen Anweisungen, solange du dich im Abstand von bis zu neun Metern von ihm befindest.\n\nDieser Teppich misst {size} und hat eine Flugbewegungsrate von {s} Metern. Er kann bis zu {w} kg tragen, doch seine Flugbewegungsrate sinkt auf {s2} Meter, wenn er mehr als {w2} kg trägt.",
        "Puedes pronunciar la palabra de mando de la alfombra como una acción para hacer que flote y vuele. Se mueve según tus indicaciones verbales, siempre que estés a 9 m o menos de ella.\n\nEsta alfombra mide {size} y tiene una velocidad de vuelo de {s} m. Puede transportar hasta {w} kg, pero su velocidad de vuelo pasa a ser de {s2} m si transporta más de {w2} kg."),
    "horn": (
        "Il personaggio può usare un’azione per suonare questo corno. In risposta al suono, entro 18 metri da lui compaiono {dice} spiriti guerrieri provenienti dal Valhalla, che utilizzano le statistiche del berserker. Tornano nel Valhalla dopo 1 ora o quando scendono a 0 punti ferita. Una volta usato, il corno non può essere riutilizzato finché non sono trascorsi 7 giorni.\n\n{tail}",
        "Au prix d’une action, vous pouvez souffler dans ce cor. En réponse, {dice} esprits guerriers du Valhalla apparaissent dans un rayon de 18 m autour de vous. Ils utilisent les statistiques d’un berserker. Ils retournent au Valhalla après 1 heure ou lorsqu’ils tombent à 0 point de vie. Une fois utilisé, le cor ne peut plus l’être avant 7 jours.\n\n{tail}",
        "Du kannst als Aktion in dieses Horn blasen. Daraufhin erscheinen {dice} Kriegergeister aus Walhalla im Abstand von bis zu 18 Metern von dir. Sie verwenden die Werte eines Berserkers. Sie kehren nach 1 Stunde oder bei 0 Trefferpunkten nach Walhalla zurück. Nach der Verwendung kann das Horn erst nach 7 Tagen wieder verwendet werden.\n\n{tail}",
        "Puedes usar una acción para tocar este cuerno. En respuesta, aparecen {dice} espíritus guerreros del Valhalla a 18 m o menos de ti. Usan las estadísticas de un berserker. Regresan al Valhalla pasada 1 hora o cuando llegan a 0 puntos de golpe. Una vez usado, el cuerno no puede volver a usarse hasta que pasen 7 días.\n\n{tail}"),
    "horn-friendly": (
        "I berserker evocati sono amichevoli nei confronti del personaggio e dei suoi compagni e seguono i suoi ordini.",
        "Les berserkers invoqués sont amicaux envers vous et vos compagnons et suivent vos ordres.",
        "Die beschworenen Berserker sind dir und deinen Gefährten gegenüber freundlich und befolgen deine Befehle.",
        "Los berserkers invocados son amistosos contigo y tus compañeros y siguen tus órdenes."),
    "horn-requirement": (
        "Se il personaggio suona il corno senza essere competente in {req}, i berserker evocati lo attaccano. Se soddisfa il requisito, sono amichevoli nei suoi confronti e in quelli dei suoi compagni e seguono i suoi ordini.",
        "Si vous soufflez dans le cor sans maîtriser {req}, les berserkers invoqués vous attaquent. Si vous remplissez la condition, ils sont amicaux envers vous et vos compagnons et suivent vos ordres.",
        "Wenn du in das Horn bläst, ohne in {req} geübt zu sein, greifen dich die beschworenen Berserker an. Erfüllst du die Voraussetzung, sind sie dir und deinen Gefährten gegenüber freundlich und befolgen deine Befehle.",
        "Si tocas el cuerno sin tener competencia con todas las {req}, los berserkers invocados te atacan. Si cumples el requisito, son amistosos contigo y tus compañeros y siguen tus órdenes."),
    "golem": (
        "Questo tomo contiene le informazioni e i rituali necessari a creare un golem {golem}. Per decifrare e usare il manuale, il personaggio deve essere un incantatore e possedere almeno due slot incantesimo di 5° livello. Una creatura che non è in grado di usare il manuale dei golem e tenta di leggerlo comunque subisce 6d6 danni psichici.\n\nPer creare un golem, il personaggio deve dedicare {days} giorni al lavoro, senza interruzioni, con il manuale a portata di mano, riposando non più di 8 ore al giorno. Deve inoltre spendere {gp} mo per acquistare i materiali.\n\nUna volta terminata la creazione del golem, il libro viene consumato da fiamme mistiche. Il golem si anima quando le ceneri del manuale vengono sparse su di esso. È sotto il controllo del personaggio e comprende e obbedisce ai suoi comandi vocali.",
        "Ce tome contient les informations et les incantations nécessaires à la fabrication d’un golem {golem}. Pour déchiffrer et utiliser le manuel, vous devez être un lanceur de sorts disposant d’au moins deux emplacements de sort de niveau 5. Une créature qui ne peut pas utiliser un manuel des golems et tente tout de même de le lire subit 6d6 dégâts psychiques.\n\nPour créer un golem, vous devez y consacrer {days} jours, sans interruption, le manuel à portée de main, en vous reposant au plus 8 heures par jour. Vous devez aussi dépenser {gp} po en fournitures.\n\nUne fois la création du golem terminée, le livre est consumé par des flammes occultes. Le golem s’anime lorsque les cendres du manuel sont répandues sur lui. Il est sous votre contrôle, comprend vos ordres oraux et leur obéit.",
        "Dieser Wälzer enthält die Informationen und Beschwörungsformeln, die zur Herstellung eines {golem} nötig sind. Um das Handbuch zu entziffern und zu verwenden, musst du ein Zauberwirker mit mindestens zwei Zauberplätzen des 5. Grades sein. Eine Kreatur, die ein Handbuch der Golems nicht verwenden kann und es dennoch zu lesen versucht, erleidet 6W6 psychischen Schaden.\n\nUm einen Golem herzustellen, musst du {days} Tage ununterbrochen mit dem Handbuch zur Hand arbeiten und dabei höchstens 8 Stunden pro Tag rasten. Außerdem musst du {gp} GM für Materialien bezahlen.\n\nSobald du die Herstellung des Golems abgeschlossen hast, wird das Buch von geheimnisvollen Flammen verzehrt. Der Golem erwacht, wenn die Asche des Handbuchs über ihn gestreut wird. Er steht unter deiner Kontrolle und versteht und befolgt deine gesprochenen Befehle.",
        "Este tomo contiene la información y los encantamientos necesarios para crear un gólem {golem}. Para descifrar y usar el manual, debes ser un lanzador de conjuros con al menos dos espacios de conjuro de nivel 5. Una criatura que no puede usar un manual de gólems e intenta leerlo sufre 6d6 de daño psíquico.\n\nPara crear un gólem, debes dedicar {days} días, trabajando sin interrupción con el manual a mano y descansando no más de 8 horas al día. También debes pagar {gp} po para comprar suministros.\n\nCuando terminas de crear el gólem, el libro es consumido por llamas sobrenaturales. El gólem cobra vida cuando se esparcen sobre él las cenizas del manual. Está bajo tu control y entiende y obedece tus órdenes verbales."),
    "gem": (
        "{gem} contiene un frammento di energia elementale. Quando il personaggio usa un’azione per rompere la gemma, viene evocato {elemental} come se avesse lanciato l’incantesimo {spell}, e la gemma perde la sua magia.",
        "{gem} contient une parcelle d’énergie élémentaire. Lorsque vous utilisez une action pour briser la gemme, {elemental} est invoqué comme si vous aviez lancé le sort {spell}, et la gemme perd sa magie.",
        "{gem} enthält einen Funken elementarer Energie. Wenn du als Aktion den Edelstein zerbrichst, wird {elemental} beschworen, als hättest du den Zauber {spell} gewirkt, und die Magie des Edelsteins ist verbraucht.",
        "{gem} contiene una pizca de energía elemental. Cuando usas una acción para romper la gema, se invoca a {elemental} como si hubieras lanzado el conjuro {spell}, y la gema pierde su magia."),
    "dragon-mail": (
        "La corazza di scaglie di drago è ricavata dalle scaglie di un drago {color}. A volte i draghi raccolgono le scaglie che hanno perso e le donano agli umanoidi. Altre volte i cacciatori scuoiano con cura un drago morto e ne conservano la pelle. In entrambi i casi, la corazza di scaglie di drago è molto apprezzata.\n\nMentre indossa questa armatura, il personaggio ottiene un bonus di +1 alla CA, ha vantaggio ai tiri salvezza contro la Presenza Spaventosa e le armi a soffio dei draghi e ha resistenza ai danni {dmg}.\n\nInoltre, con un’azione può concentrare i sensi per percepire magicamente la distanza e la direzione del drago {color} più vicino entro 48 km. Questa azione speciale non può essere riutilizzata fino all’alba successiva.",
        "L’armure d’écailles de dragon est confectionnée avec les écailles d’un dragon {color}. Parfois, les dragons rassemblent leurs écailles tombées pour les offrir à des humanoïdes. Dans d’autres cas, des chasseurs dépouillent avec soin un dragon mort et conservent sa peau. Dans les deux cas, l’armure d’écailles de dragon est très prisée.\n\nTant que vous portez cette armure, vous bénéficiez d’un bonus de +1 à la CA, vous avez l’avantage aux jets de sauvegarde contre la Présence terrifiante et les souffles des dragons, et vous avez la résistance aux dégâts {dmg}.\n\nDe plus, au prix d’une action, vous pouvez concentrer vos sens pour discerner magiquement la distance et la direction du dragon {color} le plus proche dans un rayon de 48 km. Cette action spéciale ne peut pas être réutilisée avant l’aube suivante.",
        "Drachenschuppenpanzer wird aus den Schuppen eines {color} gefertigt. Manchmal sammeln Drachen ihre abgeworfenen Schuppen und schenken sie Humanoiden. In anderen Fällen häuten Jäger einen toten Drachen sorgfältig und bewahren seine Haut auf. In beiden Fällen ist Drachenschuppenpanzer sehr begehrt.\n\nSolange du diese Rüstung trägst, erhältst du einen Bonus von +1 auf deine RK, hast Vorteil bei Rettungswürfen gegen die Furchterregende Präsenz und die Odemwaffen von Drachen und besitzt Resistenz gegen {dmg}.\n\nAußerdem kannst du als Aktion deine Sinne bündeln, um magisch die Entfernung und Richtung zum nächstgelegenen {color} innerhalb von 48 Kilometern zu erkennen. Diese besondere Aktion kann erst nach der nächsten Morgendämmerung wieder verwendet werden.",
        "La armadura de escamas de dragón se fabrica con las escamas de un dragón {color}. A veces los dragones recogen las escamas que mudan y se las regalan a humanoides. Otras veces, los cazadores desuellan con cuidado un dragón muerto y conservan su piel. En cualquier caso, la armadura de escamas de dragón es muy valorada.\n\nMientras lleves esta armadura, obtienes un bonificador de +1 a la CA, tienes ventaja en las tiradas de salvación contra la Presencia Aterradora y las armas de aliento de los dragones, y tienes resistencia al daño {dmg}.\n\nAdemás, puedes concentrar tus sentidos como acción para discernir mágicamente la distancia y la dirección del dragón {color} más cercano en un radio de 48 km. Esta acción especial no puede volver a usarse hasta el próximo amanecer."),
    "scroll": (
        "Una pergamena magica riporta le parole di un singolo incantesimo, scritte in un codice mistico. Se l’incantesimo è nella lista degli incantesimi della classe del personaggio, questi può leggere la pergamena e lanciarlo senza fornire alcuna componente materiale. In caso contrario, la pergamena è incomprensibile. Lanciare l’incantesimo leggendo la pergamena richiede il normale tempo di lancio. Una volta lanciato l’incantesimo, le parole sulla pergamena svaniscono e la pergamena si riduce in polvere. Se il lancio viene interrotto, la pergamena non va perduta.\n\nSe l’incantesimo è nella lista degli incantesimi della classe del personaggio ma di livello superiore a quelli che può normalmente lanciare, il personaggio deve effettuare una prova di caratteristica usando la sua caratteristica da incantatore per determinare se riesce a lanciarlo. La CD è pari a 10 + il livello dell’incantesimo. Se la prova fallisce, l’incantesimo scompare dalla pergamena senza altri effetti.\n\n{level} La CD del tiro salvezza dell’incantesimo è {dc} e il bonus di attacco è +{atk}.",
        "Un parchemin de sort porte les mots d’un seul sort, rédigés dans un chiffre mystique. Si le sort figure sur la liste de sorts de votre classe, vous pouvez lire le parchemin et lancer son sort sans fournir de composantes matérielles. Sinon, le parchemin est incompréhensible. Lancer le sort en lisant le parchemin demande son temps d’incantation normal. Une fois le sort lancé, les mots s’effacent du parchemin, qui tombe en poussière. Si l’incantation est interrompue, le parchemin n’est pas perdu.\n\nSi le sort figure sur la liste de sorts de votre classe, mais qu’il est d’un niveau supérieur à ceux que vous pouvez normalement lancer, vous devez réussir un test de caractéristique avec votre caractéristique d’incantation pour le lancer. Le DD est égal à 10 + le niveau du sort. En cas d’échec, le sort disparaît du parchemin sans autre effet.\n\n{level} Le DD du jet de sauvegarde du sort est de {dc} et son bonus d’attaque est de +{atk}.",
        "Auf einer Zauberschriftrolle stehen die Worte eines einzelnen Zaubers, geschrieben in einer mystischen Geheimschrift. Steht der Zauber auf der Zauberliste deiner Klasse, kannst du die Schriftrolle lesen und den Zauber wirken, ohne Materialkomponenten bereitstellen zu müssen. Andernfalls ist die Schriftrolle unverständlich. Das Wirken des Zaubers durch Lesen der Schriftrolle erfordert die normale Zeit zum Zaubern. Sobald der Zauber gewirkt wurde, verblassen die Worte auf der Schriftrolle und sie zerfällt zu Staub. Wird das Wirken unterbrochen, geht die Schriftrolle nicht verloren.\n\nSteht der Zauber auf der Zauberliste deiner Klasse, ist aber von höherem Grad, als du normalerweise wirken kannst, musst du einen Attributswurf mit deinem Zauberattribut ausführen, um festzustellen, ob du ihn erfolgreich wirkst. Der SG entspricht 10 + dem Grad des Zaubers. Bei einem Fehlschlag verschwindet der Zauber ohne weitere Wirkung von der Schriftrolle.\n\n{level} Der Rettungswurf-SG des Zaubers beträgt {dc} und der Angriffsbonus +{atk}.",
        "Un pergamino de conjuro contiene las palabras de un único conjuro, escritas en un cifrado místico. Si el conjuro está en la lista de conjuros de tu clase, puedes leer el pergamino y lanzar su conjuro sin necesidad de aportar componentes materiales. En caso contrario, el pergamino es ininteligible. Lanzar el conjuro leyendo el pergamino requiere el tiempo de lanzamiento normal del conjuro. Una vez lanzado, las palabras del pergamino se desvanecen y este se convierte en polvo. Si el lanzamiento se interrumpe, el pergamino no se pierde.\n\nSi el conjuro está en la lista de conjuros de tu clase pero es de un nivel superior al que puedes lanzar normalmente, debes hacer una prueba de característica usando tu característica de lanzamiento de conjuros para determinar si lo lanzas con éxito. La CD es igual a 10 + el nivel del conjuro. Si fallas la prueba, el conjuro desaparece del pergamino sin ningún otro efecto.\n\n{level} La CD de la salvación del conjuro es {dc} y el bonificador de ataque es +{atk}."),
    "scroll-level": (  # the sentence about the spell, and for a cantrip the one that starts it
        "Questa pergamena contiene {what}.", "Ce parchemin contient {what}.", "Diese Schriftrolle enthält {what}.", "Este pergamino contiene {what}."),
    "scroll-copy": (
        "Un incantesimo da mago su una pergamena magica può essere copiato come gli incantesimi dei libri degli incantesimi. Quando un incantesimo viene copiato da una pergamena magica, chi lo copia deve superare una prova di {ability} ({skill}) con CD {dc}. Se la prova riesce, l’incantesimo viene copiato con successo. Che la prova riesca o fallisca, la pergamena magica viene distrutta.",
        "Un sort de magicien figurant sur un parchemin de sort peut être copié comme les sorts d’un grimoire. Lorsqu’un sort est copié depuis un parchemin de sort, le copiste doit réussir un test d’{ability} ({skill}) DD {dc}. En cas de réussite, le sort est copié. Que le test réussisse ou échoue, le parchemin de sort est détruit.",
        "Ein Magierzauber auf einer Zauberschriftrolle kann wie Zauber in Zauberbüchern kopiert werden. Wird ein Zauber von einer Zauberschriftrolle kopiert, muss der Kopierende einen {ability}wurf ({skill}) mit SG {dc} bestehen. Bei einem Erfolg wird der Zauber erfolgreich kopiert. Ob der Wurf gelingt oder misslingt, die Zauberschriftrolle wird zerstört.",
        "Un conjuro de mago de un pergamino de conjuro puede copiarse igual que los conjuros de los libros de conjuros. Al copiar un conjuro de un pergamino de conjuro, quien lo copia debe superar una prueba de {ability} ({skill}) con CD {dc}. Si la prueba tiene éxito, el conjuro se copia correctamente. Tanto si la prueba tiene éxito como si falla, el pergamino de conjuro se destruye."),
}
SCROLL_WHAT = {  # (cantrip, "{n}th level spell")
    "it": ("un trucchetto", "un incantesimo di {n}° livello"),
    "fr": ("un sort mineur", "un sort de niveau {n}"),
    "de": ("einen Zaubertrick", "einen Zauber des {n}. Grades"),
    "es": ("un truco", "un conjuro de nivel {n}"),
}
INTRO = {  # crystal balls and feather tokens: the sentence in front of the variant
    "crystal": (
        "La sfera di cristallo ha un diametro di circa 15 cm. Toccandola, il personaggio può lanciare con essa l’incantesimo {scrying} (CD del tiro salvezza 17).",
        "La boule de cristal mesure environ 15 cm de diamètre. En la touchant, vous pouvez lancer le sort {scrying} (DD de sauvegarde 17) avec elle.",
        "Die Kristallkugel hat einen Durchmesser von etwa 15 Zentimetern. Wenn du sie berührst, kannst du den Zauber {scrying} (Rettungswurf-SG 17) mit ihr wirken.",
        "La bola de cristal mide unos 15 cm de diámetro. Mientras la toques, puedes lanzar con ella el conjuro {scrying} (CD de salvación 17)."),
}
GOLEMS = (("clay", 30, 65000), ("flesh", 60, 50000), ("iron", 120, 100000), ("stone", 90, 80000))
GOLEM_OF = {
    "it": ["di argilla", "di carne", "di ferro", "di pietra"], "fr": ["d’argile", "de chair", "de fer", "de pierre"],
    "de": ["Tongolems", "Fleischgolems", "Eisengolems", "Steingolems"], "es": ["de arcilla", "de carne", "de hierro", "de piedra"],
}
HORNS = (("silver", "2d4 + 2", None), ("brass", "3d4 + 3", 0), ("bronze", "4d4 + 4", 1), ("iron", "5d4 + 5", 2))
HORN_REQ = {
    "it": ["tutte le armi semplici", "tutte le armature medie", "tutte le armi da guerra"],
    "fr": ["toutes les armes courantes", "toutes les armures intermédiaires", "toutes les armes de guerre"],
    "de": ["allen einfachen Waffen", "allen mittelschweren Rüstungen", "allen Kriegswaffen"],
    "es": ["armas sencillas", "armaduras medias", "armas marciales"],
}
GEMS = (  # slug, element index, phrase with the demonstrative per language
    ("air", {"it": "Questo zaffiro blu", "fr": "Ce saphir bleu", "de": "Dieser blaue Saphir", "es": "Este zafiro azul"}),
    ("earth", {"it": "Questo diamante giallo", "fr": "Ce diamant jaune", "de": "Dieser gelbe Diamant", "es": "Este diamante amarillo"}),
    ("fire", {"it": "Questo corindone rosso", "fr": "Ce corindon rouge", "de": "Dieser rote Korund", "es": "Este corindón rojo"}),
    ("water", {"it": "Questo smeraldo", "fr": "Cette émeraude", "de": "Dieser Smaragd", "es": "Esta esmeralda"}),
)
ELEMENTAL = {
    "it": ["un elementale dell’aria", "un elementale della terra", "un elementale del fuoco", "un elementale dell’acqua"],
    "fr": ["un élémentaire d’air", "un élémentaire de terre", "un élémentaire de feu", "un élémentaire d’eau"],
    "de": ["ein Luftelementar", "ein Erdelementar", "ein Feuerelementar", "ein Wasserelementar"],
    "es": ["un elemental de aire", "un elemental de tierra", "un elemental de fuego", "un elemental de agua"],
}
DRAGON_MAIL = (("black", 0), ("blue", 4), ("brass", 2), ("bronze", 4), ("copper", 0), ("gold", 2), ("green", 6), ("red", 2), ("silver", 1), ("white", 1))
DRAGON_COLOR = {  # as it follows "dragon"; German is the declined noun phrase
    "it": ["nero", "blu", "d’ottone", "di bronzo", "di rame", "d’oro", "verde", "rosso", "d’argento", "bianco"],
    "fr": ["noir", "bleu", "d’airain", "de bronze", "de cuivre", "d’or", "vert", "rouge", "d’argent", "blanc"],
    "de": ["schwarzen Drachen", "blauen Drachen", "Messingdrachen", "Bronzedrachen", "Kupferdrachen", "Golddrachen", "grünen Drachen", "roten Drachen", "Silberdrachen", "weißen Drachen"],
    "es": ["negro", "azul", "de latón", "de bronce", "de cobre", "de oro", "verde", "rojo", "de plata", "blanco"],
}
IOUN = ("absorption", "agility", "awareness", "fortitude", "greater-absorption", "insight", "intellect", "leadership", "mastery", "protection", "regeneration", "reserve", "strength", "sustenance")
FEATHERS = ("anchor", "bird", "fan", "swan-boat", "tree", "whip")
CRYSTALS = ("mind-reading", "telepathy", "true-seeing")
NUMBERS = {"it": ".", "fr": " ", "de": ".", "es": "."}
DECIMAL = ","

TYPE_LINE = re.compile(
    r"^(Oggetto|Objet|Wundersamer|Objeto|Arma|Armatura|Armure|Arme|Rüstung|Waffe|Anello|Anneau|Ring|Anillo|Pozione|Potion|Trank|Poción|"
    r"Bacchetta|Baguette|Zauberstab|Varita|Verga|Sceptre|Stab|Bastón|Pergamena|Parchemin|Schriftrolle|Pergamino|Artefatto|Artefact|Artefakt)\b"
)


def metric(feet: int, lang: str) -> str:
    value = feet * 0.3
    text = f"{value:.1f}".rstrip("0").rstrip(".")
    return text.replace(".", DECIMAL)


def thousands(n: int, lang: str) -> str:
    return f"{n:,}".replace(",", NUMBERS[lang])


def read_lines(pdf: Path, lang: str) -> list[str]:
    lines = pdf_lines(pdf, LANGUAGES[lang]["noise"])
    return [l for l in lines if not FOOTER.search(l) and not re.fullmatch(r"\s*\d{1,3}\s*", l) and not l.startswith("<<")]


def section(lines: list[str], title: str) -> list[str]:
    """The lines under a heading (a line equal to `title`, followed by the kind of item) up to the next heading."""
    for i, line in enumerate(lines):
        if key(line.strip()) == key(title) and i + 1 < len(lines) and TYPE_LINE.match(lines[i + 1].strip()):
            for j in range(i + 2, len(lines) - 1):
                if len(lines[j].strip()) < 48 and TYPE_LINE.match(lines[j + 1]) and not lines[j].startswith(" "):
                    return lines[i + 2 : j]
            return lines[i + 2 :]
    return []


def join(parts: list[str], lang: str) -> str:
    text = ""
    for part in (p.strip() for p in parts):
        text += part if (text.endswith("-") and lang == "de") or not text else " " + part
    return re.sub(r"\s+", " ", text.replace("­", "")).strip()


def entries(body: list[str], lang: str) -> dict[str, list[str]]:
    """Paragraphs of a section that start with " Title. ", " Title (rarity). " or " Title: ", grouped by title."""
    start = re.compile(r"^[  ]+([A-ZÀ-ÝÄÖÜ][^.:(]{1,60}?)(?: \([^)]*\))?[.:] ?(.*)$")
    out: dict[str, list[list[str]]] = {}
    current: list[str] | None = None
    last = ""
    for line in body:
        m = start.match(line)
        if m:
            last = key(m.group(1).replace('’', "'"))
            current = [m.group(2)]
            out.setdefault(last, []).append(current)
        elif line.startswith((" ", " ")) and line.strip() and last:
            current = [line.strip()]  # a new paragraph of the same entry
            out[last].append(current)
        elif current is not None and line.strip():
            current.append(line.strip())
    return {k: [join(p, lang) for p in v] for k, v in out.items()}


def main(lang: str, pdf: Path, write: bool) -> None:
    c = LANGS.index(lang)
    english = load_en("items")
    path = ROOT / "locales" / lang / "srd51" / "items.json"
    raw = path.read_bytes().decode("utf-8")
    newline = "\r\n" if "\r\n" in raw else "\n"
    current = json.loads(raw)
    skills = json.loads((ROOT / "locales" / lang / "srd51" / "skills.json").read_text(encoding="utf-8"))
    abilities = json.loads((ROOT / "locales" / lang / "srd51" / "abilities.json").read_text(encoding="utf-8"))
    spells = json.loads((ROOT / "locales" / lang / "srd51" / "spells.json").read_text(encoding="utf-8"))

    def spell(slug: str) -> str:
        name = spells.get(f"{slug}.name", slug)
        return name if lang == "de" else name.lower()

    # English first line -> this language's, from the items already translated, then the lines above.
    header: dict[str, str] = {}
    for k, v in english.items():
        if k.endswith(".desc") and current.get(k) and "\n\n" in v and "\n\n" in current[k]:
            header.setdefault(v.split("\n\n")[0], current[k].split("\n\n")[0])
    for h, names in HEADERS.items():
        header[h] = names[c]

    out: dict[str, str] = {}
    lines = read_lines(pdf, lang)

    def put(slug: str, body: str) -> None:
        k = f"{slug}.desc"
        if k not in english or current.get(k):
            return
        first = english[k].split("\n\n")[0]
        if first not in header:
            problems.append(f"{slug}: no first line for '{first}'")
            return
        out[k] = f"{header[first]}\n\n{body}"

    def fill(name: str, **values: str) -> str:
        text = T[name][c]
        for k, v in values.items():
            text = text.replace("{" + k + "}", v)
        return text

    problems: list[str] = []
    for family, slug, tmpl in (("ammunition", "ammunition", "ammunition"), ("armor", "armor", "armor"), ("weapon", "weapon", "weapon"), ("wand", "wand-of-the-war-mage", "wand")):
        for n in (1, 2, 3):
            put(f"{slug}-{n}", fill(tmpl, n=str(n)))
    for g, giant in zip(GIANTS, GIANT_OF[lang]):
        put(f"belt-of-giant-strength-{g}", fill("belt", n=str(GIANT_FORCE[g])))
        put(f"potion-of-giant-strength-{g}", fill("potion-giant", n=str(GIANT_FORCE[g]), giant=giant))
    for g, dice in HEALING.items():
        put(f"potion-of-healing-{g}", fill("potion-healing", dice=dice.replace("d", "W") if lang == "de" else dice))
    for i, d in enumerate(DAMAGE):
        put(f"potion-of-resistance-{d}", fill("potion-resistance", dmg=RESIST[lang][i]))
        put(f"ring-of-resistance-{d}", fill("ring-resistance", gem=RING_GEMS[lang][i], dmg=RESIST[lang][i]))
    for slug in ("3x5", "4x6", "5x7", "6x9"):
        k = f"carpet-of-flying-{slug}.desc"
        m = re.search(r"is (\d+) feet by (\d+) feet and has a flying speed of (\d+) feet\. It can carry up to (\d+) pounds, but its flying speed becomes (\d+) feet while carrying over (\d+) pounds", english[k])
        if not m:
            problems.append(f"{k}: not read")
            continue
        a, b, s, w, s2, w2 = (int(x) for x in m.groups())
        put(f"carpet-of-flying-{slug}", fill("carpet", size=f"{a * 30} × {b * 30} cm", s=metric(s, lang), s2=metric(s2, lang), w=thousands(w // 2, lang), w2=thousands(w2 // 2, lang)))
    for slug, dice, req in HORNS:
        tail = T["horn-friendly"][c] if req is None else fill("horn-requirement", req=HORN_REQ[lang][req])
        put(f"horn-of-valhalla-{slug}", fill("horn", dice=dice.replace("d", "W") if lang == "de" else dice, tail=tail))
    for (slug, days, gp), golem in zip(GOLEMS, GOLEM_OF[lang]):
        put(f"manual-of-golems-{slug}", fill("golem", golem=golem, days=str(days), gp=thousands(gp, lang)))
    for i, (slug, gem) in enumerate(GEMS):
        put(f"elemental-gem-{slug}", fill("gem", gem=gem[lang], elemental=ELEMENTAL[lang][i], spell=spell("conjure-elemental")))
    for i, (slug, dmg) in enumerate(DRAGON_MAIL):
        put(f"dragon-scale-mail-{slug}", fill("dragon-mail", color=DRAGON_COLOR[lang][i], dmg=RESIST[lang][dmg]))
    arcana = skills.get("arcana.name", "Arcana")
    intelligence = abilities.get("int.name", "Intelligence")
    for slug in ("cantrip", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"):
        k = f"spell-scroll-{slug}.desc"
        m = re.search(r"saving throw is (\d+) and the attack bonus is \+(\d+)", english[k])
        n = 0 if slug == "cantrip" else int(slug[0])
        what = SCROLL_WHAT[lang][0] if n == 0 else SCROLL_WHAT[lang][1].replace("{n}", str(n))
        body = fill("scroll", level=fill("scroll-level", what=what), dc=m.group(1), atk=m.group(2))
        copy = re.search(r"DC equal to (\d+)", english[k])
        if copy:
            ability = intelligence if lang != "de" else intelligence.replace("Intelligenz", "Intelligenz")
            body += "\n\n" + fill("scroll-copy", ability=ability if lang != "fr" else intelligence, skill=arcana, dc=copy.group(1))
        put(f"spell-scroll-{slug}", body)

    # Families with a paragraph for each variant in the book.
    ioun_titles = {"it": "Pietra di Ioun", "fr": "Pierre de Ioun", "de": "Ionenstein", "es": "Piedra Ioun"}
    ioun_names = {s: current.get(f"ioun-stone-of-{s}.name", "") for s in IOUN}
    feather_title = {"it": "Piuma magica", "fr": "Plume magique", "de": "Federfigur", "es": "Ficha de pluma"}
    crystal_title = {"it": "Sfera di cristallo", "fr": "Boule de cristal", "de": "Kristallkugel", "es": "Bola de cristal"}
    body = section(lines, ioun_titles[lang])
    if body:
        first_stone = next((i for i, l in enumerate(body) if re.match(r"^[  ]+[A-ZÀ-ÝÄÖÜ][^.:]{1,40} \([^)]*\)[.:]", l)), 0)
        head = [l for l in body[:first_stone] if not l.strip().startswith("(")]  # the attunement line is in the first line
        intro_paragraphs = [join(p.split("\n"), lang) for p in re.split(r"\n(?=[  ])", "\n".join(head))]
        stones = entries(body[first_stone:], lang)
        for s in IOUN:
            term = re.sub(r".*\(|\)$", "", ioun_names[s])
            paras = stones.get(key(term.replace('’', "'")))
            if not paras:
                problems.append(f"ioun-stone-of-{s}: no paragraph for '{term}'")
                continue
            text = "\n\n".join([*intro_paragraphs, f"***{term}.*** {paras[0]}", *paras[1:]])
            put(f"ioun-stone-of-{s}", text)
    else:
        problems.append("ioun stones: section not found")
    body = section(lines, feather_title[lang])
    if body:
        first = next((i for i, l in enumerate(body) if re.match(r"^[  ]+[A-ZÀ-ÝÄÖÜ][^.:]{1,30}[.:]", l) and not re.match(r"^[  ]*(d100|W100)", l)), 0)
        cut = next((i for i, l in enumerate(body) if re.match(r"^[  ]+[A-ZÀ-ÝÄÖÜ][^.:]{1,30}[.:] [A-ZÀ-ÝÄÖÜ]", l)), first)
        intro = join(body[: next((i for i, l in enumerate(body) if re.match(r"^(d100|W100)", l.strip())), 1)], lang)
        kinds = entries(body[cut:], lang)
        for s in FEATHERS:
            term = re.sub(r".*\(|\)$", "", current.get(f"feather-token-{s}.name", ""))
            paras = kinds.get(key(term.replace('’', "'")))
            if not paras:
                problems.append(f"feather-token-{s}: no paragraph for '{term}'")
                continue
            put(f"feather-token-{s}", "\n\n".join([intro, *paras]))
    else:
        problems.append("feather tokens: section not found")
    body = section(lines, crystal_title[lang])
    if body:
        paras = entries(body, lang)
        for s in CRYSTALS:
            name = current.get(f"crystal-ball-of-{s}.name", "")
            found = paras.get(key(name)) or next((v for kk, v in paras.items() if kk.startswith(key(name)[:22])), None)
            if not found:
                problems.append(f"crystal-ball-of-{s}: no paragraph for '{name}'")
                continue
            put(f"crystal-ball-of-{s}", "\n\n".join([fill_intro("crystal", c, spell("scrying")), f"***{name}.*** {found[0]}", *found[1:]]))
    else:
        problems.append("crystal balls: section not found")

    more(lang, c, lines, current, english, put, problems, abilities, json.loads((ROOT / "locales" / lang / "ui.json").read_text(encoding="utf-8")))
    added = 0
    for k, v in out.items():
        current[k] = v
        added += 1
    ordered = {k: current[k] for k in english if k in current}
    if write:
        text = json.dumps(ordered, ensure_ascii=False, indent=2) + "\n"
        path.write_bytes(text.replace("\n", newline).encode("utf-8"))
    print(lang, "variant descriptions", "added:" if write else "that would be added:", added)
    for p in problems:
        print("   ", p)


BAG_TITLE = {"it": "Borsa dei trucchi", "fr": "Sac à malices", "de": "Trickbeutel", "es": "Bolsa de trucos"}
BAG_FIRST = (
    "Questa borsa dall’aspetto ordinario, di stoffa {color}, sembra vuota. Tuttavia, infilandovi una mano si avverte un piccolo oggetto peloso. La borsa pesa 250 g.",
    "Ce sac d’apparence ordinaire, en tissu {color}, semble vide. Pourtant, en y plongeant la main, on y sent un petit objet duveteux. Le sac pèse 250 g.",
    "Dieser gewöhnliche Beutel aus {color} Stoff scheint leer zu sein. Ein Griff in den Beutel offenbart jedoch einen kleinen, flauschigen Gegenstand. Der Beutel wiegt 250 Gramm.",
    "Esta bolsa corriente, de tela {color}, parece vacía. Sin embargo, al meter la mano dentro se nota un pequeño objeto peludo. La bolsa pesa 250 g.",
)
BAG_COLOR = {"it": ["grigia", "ruggine", "marrone"], "fr": ["gris", "rouille", "brun"], "de": ["grauem", "rostfarbenem", "beigefarbenem"], "es": ["gris", "rojiza", "marrón"]}
CREATURE = ("Creatura", "Créature", "Kreatur", "Criatura")
RING_TITLE = {"it": "Anello del comando degli elementali", "fr": "Anneau de maîtrise élémentaire", "de": "Ring der Elementar-Herrschaft", "es": "Anillo de comandar elementales"}
RING_WORDS = {  # words that tell the block of an element, in the order air, earth, fire, water
    "it": ["aria", "terra", "fuoco", "acqua"], "fr": ["air", "terre", "feu", "eau"],
    "de": ["luftelementar", "erdelementar", "feuerelementar", "wasserelementar"], "es": ["aire", "tierra", "fuego", "agua"],
}
PLANE = (
    ["Questo anello è collegato al Piano Elementale dell’Aria.", "Questo anello è collegato al Piano Elementale della Terra.", "Questo anello è collegato al Piano Elementale del Fuoco.", "Questo anello è collegato al Piano Elementale dell’Acqua."],
    ["Cet anneau est lié au plan élémentaire de l’Air.", "Cet anneau est lié au plan élémentaire de la Terre.", "Cet anneau est lié au plan élémentaire du Feu.", "Cet anneau est lié au plan élémentaire de l’Eau."],
    ["Dieser Ring ist mit der Elementarebene der Luft verbunden.", "Dieser Ring ist mit der Elementarebene der Erde verbunden.", "Dieser Ring ist mit der Elementarebene des Feuers verbunden.", "Dieser Ring ist mit der Elementarebene des Wassers verbunden."],
    ["Este anillo está vinculado al Plano Elemental del Aire.", "Este anillo está vinculado al Plano Elemental de la Tierra.", "Este anillo está vinculado al Plano Elemental del Fuego.", "Este anillo está vinculado al Plano Elemental del Agua."],
)
FIGURINE_TITLE = {"it": "Statuina del potere meraviglioso", "fr": "Figurine merveilleuse", "de": "Figur der wundersamen Kraft", "es": "Estatuilla de poder maravilloso"}
ORB_TITLE = {"it": "Sfera della stirpe dei draghi", "fr": "L’orbe des dragons", "de": "Kugel der Drachen", "es": "Orbe de los Dragones"}
END_WORD = {"it": "Mostri", "fr": "Monstres", "de": "Monster", "es": "Monstruos"}
FLY_NAME = ("Mosca gigante", "Mouche géante", "Riesenfliege", "Mosca gigante")
FLY_LINE = (  # type line, speed, senses
    ("Grande bestia, senza allineamento", "9 m, volare 18 m", "scurovisione 18 m"),
    ("Grande bête, non alignée", "9 m, vol 18 m", "vision dans le noir 18 m"),
    ("Große Bestie, gesinnungslos", "9 m, Fliegen 18 m", "Dunkelsicht 18 m"),
    ("Bestia Grande, sin alineamiento", "9 m, volar 18 m", "visión en la oscuridad 18 m"),
)
FLY_TEXT = (
    "Questa statuina di ebano raffigura un tafano. Può trasformarsi in una mosca gigante per una durata massima di 12 ore e può essere montata come cavalcatura. Una volta usata, non può essere riutilizzata finché non sono trascorsi 2 giorni.",
    "Cette statuette d’ébène a été taillée à l’effigie d’un taon. Elle se transforme en mouche géante pendant un maximum de 12 heures durant lesquelles elle peut servir de monture. Une fois cette figurine utilisée, vous ne pouvez plus y recourir pendant 2 jours.",
    "Diese kleine Statue aus Ebenholz hat die Form einer Pferdebremse. Sie kann bis zu zwölf Stunden lang zu einer Riesenfliege werden und als Reittier dienen. Nach der Verwendung kann sie erst nach 2 Tagen wieder verwendet werden.",
    "Esta estatuilla de ébano se ha tallado con la forma de un tábano. Puede convertirse en una mosca gigante durante 12 horas, como máximo, y se puede emplear como montura. Una vez que se utilice, no podrá volver a usarse hasta que hayan pasado 2 días.",
)
FLY_ABILITIES =("14 (+2)", "13 (+1)", "13 (+1)", "2 (-4)", "10 (+0)", "3 (-4)")


def paragraphs_of(body: list[str], lang: str) -> list[tuple[str | None, str]]:
    """(title or None, text): a paragraph starts at an indented line or a bullet; " Title. text" has a title."""
    blocks: list[list[str]] = []
    for line in body:
        text = line.strip()
        if not text:
            continue
        if line.startswith((" ", " ")) or text.startswith("•") or not blocks:
            blocks.append([text.lstrip("• ").strip()])
        else:
            blocks[-1].append(text)
    out = []
    for b in blocks:
        text = join(b, lang)
        m = re.match(r"^([A-ZÀ-ÝÄÖÜ][^.:,]{2,60}?)[.:] (.*)$", text)
        out.append((m.group(1), m.group(2)) if m else (None, text))
    return out


def render(parts: list[tuple[str | None, str]]) -> str:
    return "\n\n".join(f"***{t}.*** {x}" if t else x for t, x in parts)


def more(lang, c, lines, current, english, put, problems, abilities, ui):
    """Bags of tricks, figurines, rings of elemental command and the Orb of Dragonkind."""
    monsters = json.loads((ROOT / "locales" / lang / "srd51" / "monsters.json").read_text(encoding="utf-8"))
    # bags of tricks: the first paragraph with the color, the rest of the generic ones from the book, the table
    body = section(lines, BAG_TITLE[lang])
    cut = next((i for i, l in enumerate(body) if key(l.strip()).startswith(key(BAG_TITLE[lang]) + " ") and len(l.strip()) < 40), len(body))
    generic = paragraphs_of(body[:cut], lang)

    def before_table(text: str) -> str:  # the last paragraph can run into the tables of the three bags
        m = re.search(r"\b[dDW]8\s+" + CREATURE[c], text)
        if not m:
            return text
        text = text[: m.start()].rstrip()
        return text if text.endswith((".", "!", "?", "»", "”")) else text[: text.rfind(". ") + 1]

    generic = [(t, before_table(x)) for t, x in generic]
    for s, color in zip(("gray", "rust", "tan"), BAG_COLOR[lang]):
        k = f"bag-of-tricks-{s}.desc"
        rows = re.findall(r"\| (\d\d) \| ([^|]+) \|", english[k])
        table = []
        for n, name in rows:
            slug = re.sub(r"[^a-z]+", "-", name.strip().lower()).strip("-")
            translated = monsters.get(f"{slug}.name") or monsters.get(f"{slug}-diseased.name")
            if not translated:
                problems.append(f"{k}: no name for the creature '{name.strip()}'")
                translated = name.strip()
            table.append(f"| {n} | {translated} |")
        title = current.get(f"bag-of-tricks-{s}.name", "")
        text = "\n\n".join([BAG_FIRST[c].replace("{color}", color), *[x for _, x in generic[1:]],
                            f"{title}:", f"| d8 | {CREATURE[c]} |", "|---|---|", *table])
        put(f"bag-of-tricks-{s}", text)
    # figurines of wondrous power: a shared introduction, then the paragraph of the figurine
    body = section(lines, FIGURINE_TITLE[lang])
    first = next((i for i, l in enumerate(body) if re.match(r"^[  ]+[A-ZÀ-ÝÄÖÜ][^.:(]{2,40} \([^)]*\)[.:]", l)), 0)
    intro = [x for _, x in paragraphs_of(body[:first], lang)]
    variants = entries(body[first:], lang)
    for s in ("bronze-griffon", "ebony-fly", "golden-lions", "ivory-goats", "marble-elephant", "obsidian-steed", "onyx-dog", "serpentine-owl", "silver-raven"):
        name = current.get(f"figurine-of-wondrous-power-{s}.name", "")
        term = re.sub(r".*\(|\)$", "", name)
        paras = variants.get(key(term.replace('’', "'")))
        if not paras:
            problems.append(f"figurine-of-wondrous-power-{s}: no paragraph for '{term}'")
            continue
        if s == "ebony-fly":  # the book's stat block breaks the paragraph and comes out as one line: written here
            paras = [FLY_TEXT[c]]
        text = "\n\n".join([*intro, f"***{term}.*** {paras[0]}", *[p for p in paras[1:] if p]])
        if s == "ebony-fly":
            ab = [abilities.get(f"{a}.abbreviation", a.upper()) for a in ("str", "dex", "con", "int", "wis", "cha")]
            kind, speed, senses = FLY_LINE[c]
            text += "\n\n" + "\n\n".join([
                FLY_NAME[c], kind, f"{ui['monster.ac']} 11", f"{ui['monster.hp']} 19 (3d10 + 3)", f"{ui['monster.speed']} {speed}",
                "| " + " | ".join(ab) + " |", "|---|---|---|---|---|---|", "| " + " | ".join(FLY_ABILITIES) + " |",
                f"{ui['monster.senses']} {senses}, {ui['monster.passivePerception'].replace('{n}', '10')}", f"{ui['monster.languages']} -",
            ])
        put(f"figurine-of-wondrous-power-{s}", text)
    # rings of elemental command: the general paragraphs, then the block of the element
    body = section(lines, RING_TITLE[lang])
    parts = paragraphs_of(body, lang)
    def whole(part: tuple[str | None, str]) -> str:  # a short first sentence is not a title here
        return f"{part[0]}. {part[1]}" if part[0] else part[1]

    words = RING_WORDS[lang]
    at = [i for i, (t, x) in enumerate(parts) if t and any(w in key(t) for w in words) and key(t).startswith(("anello", "anneau", "ring", "anillo"))]
    general = parts[: at[0]] if at else []
    for n, (s, word) in enumerate(zip(("air", "earth", "fire", "water"), words)):
        def names(i: int) -> bool:  # "eau" is also in "anneau": look for the word, after the family's own title
            tail = key(parts[i][0] or "").removeprefix(key(RING_TITLE[lang]))
            return word in tail if lang == "de" else re.search(rf"\b{word}\b", tail) is not None

        mine = next((i for i in at if names(i)), None)
        if mine is None or len(general) < 3:
            problems.append(f"ring-of-elemental-command-{s}: block not found")
            continue
        end = next((j for j in at if j > mine), len(parts))
        block = [parts[mine][1], *[whole(p) for p in parts[mine + 1 : end]]]
        text = "\n\n".join([PLANE[c][n], whole(general[1]), whole(general[2]), *block])
        put(f"ring-of-elemental-command-{s}", text)
    # the Orb of Dragonkind
    body = section(lines, ORB_TITLE[lang])
    stop = next((i for i, l in enumerate(body) if l.strip() == END_WORD[lang]), len(body))
    orb = paragraphs_of(body[:stop], lang)
    if orb:
        put("orb-of-dragonkind", render(orb))
    else:
        problems.append("orb-of-dragonkind: section not found")


def fill_intro(name: str, column: int, scrying: str) -> str:
    return INTRO[name][column].replace("{scrying}", scrying)


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    main(sys.argv[1], Path(sys.argv[2]), "--write" in sys.argv)
