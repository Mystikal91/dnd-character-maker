import type { LanguageCode } from "../app/language.logic";

/** A text in every language it has been written in; English is required and is the fallback. */
export type Translated = { en: string } & Partial<Record<Exclude<LanguageCode, "en">, string>>;

export interface ChangelogEntry {
  version: string;
  /** ISO date of the release. */
  date: string;
  /** What changed, one line each. Newest entries go first in `CHANGELOG`. */
  notes: Translated[];
}

/**
 * What changed in each version. To add an entry, put a new object first in the list, write the
 * lines in English and, when possible, in the other languages (the page shows English where a
 * language is missing).
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.2 beta",
    date: "2026-10-21",
    notes: [
      {
        en: "Equipping is easy to find: the inventory on the sheet has a tick with the word Equipped for each item, the Attacks panel offers an Equip button for a weapon you carry, and the Equipment step says what the tick is for.",
        it: "Equipaggiare si trova subito: l'inventario nella scheda ha una spunta con la parola Equipaggiato per ogni oggetto, il pannello Attacchi propone un pulsante Equipaggia per un'arma che porti con te, e il passo Equipaggiamento spiega a cosa serve la spunta.",
        fr: "Équiper se trouve facilement : l'inventaire de la fiche a une case avec le mot Équipé pour chaque objet, le panneau Attaques propose un bouton Équiper pour une arme que tu portes, et l'étape Équipement dit à quoi sert la case.",
        de: "Ausrüsten ist leicht zu finden: Das Inventar auf dem Bogen hat zu jedem Gegenstand ein Häkchen mit dem Wort Ausgerüstet, das Feld Angriffe bietet einen Knopf Ausrüsten für eine mitgeführte Waffe, und der Schritt Ausrüstung sagt, wofür das Häkchen da ist.",
        es: "Equipar se encuentra fácil: el inventario de la hoja tiene una casilla con la palabra Equipado para cada objeto, el panel Ataques ofrece un botón Equipar para un arma que llevas, y el paso Equipo dice para qué sirve la casilla.",
      },
      {
        en: 'In Play, a Cast button next to each spell spends the lowest slot that fits (a Pact Magic slot if there is none) and says which one in the roll log, and the notes can be written there too. In Equipment, a search box narrows the long list of items. Also: the page is announced better to screen readers (hit points are read out when they change), a "skip to the content" button for the keyboard, the browser tab shows the character\'s name, and the browser bar takes the colour of the page.',
        it: 'In Gioca, un pulsante Lancia accanto a ogni incantesimo spende lo slot più basso adatto (uno slot della Magia del Patto se non ce ne sono) e dice quale nel registro dei tiri, e lì si possono scrivere anche gli appunti. In Equipaggiamento, una casella di ricerca restringe la lunga lista di oggetti. Inoltre: la pagina è annunciata meglio ai lettori di schermo (i punti ferita vengono letti quando cambiano), c\'è un pulsante "vai al contenuto" per la tastiera, la scheda del browser mostra il nome del personaggio e la barra del browser prende il colore della pagina.',
        fr: "Dans Jouer, un bouton Lancer à côté de chaque sort dépense le plus petit emplacement qui convient (un emplacement de Magie de pacte s'il n'y en a pas) et dit lequel dans l'historique des jets, et les notes peuvent aussi s'y écrire. Dans Équipement, une zone de recherche réduit la longue liste d'objets. Aussi : la page est mieux annoncée aux lecteurs d'écran (les points de vie sont lus quand ils changent), un bouton « aller au contenu » pour le clavier, l'onglet du navigateur affiche le nom du personnage et la barre du navigateur prend la couleur de la page.",
        de: 'In Spielen verbraucht ein Knopf Wirken neben jedem Zauber den niedrigsten passenden Platz (einen Paktmagie-Platz, wenn keiner da ist) und nennt ihn im Wurfprotokoll, und die Notizen lassen sich auch dort schreiben. In Ausrüstung grenzt ein Suchfeld die lange Liste der Gegenstände ein. Außerdem: Die Seite wird Screenreadern besser angesagt (Trefferpunkte werden bei Änderung vorgelesen), ein Knopf "Zum Inhalt springen" für die Tastatur, der Browser-Tab zeigt den Namen des Charakters und die Browserleiste übernimmt die Farbe der Seite.',
        es: 'En Jugar, un botón Lanzar junto a cada conjuro gasta el espacio más bajo que sirva (uno de Magia de pacto si no hay) y dice cuál en el registro de tiradas, y también se pueden escribir allí las notas. En Equipo, un cuadro de búsqueda reduce la larga lista de objetos. Además: la página se anuncia mejor a los lectores de pantalla (los puntos de golpe se leen al cambiar), un botón "saltar al contenido" para el teclado, la pestaña del navegador muestra el nombre del personaje y la barra del navegador toma el color de la página.',
      },
      {
        en: "Fixes: the point buy no longer overflows its box on phones, and printing no longer leaves a blank page after the first sheet (the page's own padding pushed the sheet down; it showed up on computers too).",
        it: "Correzioni: l'acquisto a punti non sborda più dal suo riquadro sul telefono, e la stampa non lascia più una pagina vuota dopo la prima scheda (il margine interno della pagina spingeva giù la scheda; succedeva anche sui computer).",
        fr: "Corrections : l'achat de points ne déborde plus de son cadre sur téléphone, et l'impression ne laisse plus de page blanche après la première fiche (la marge interne de la page poussait la fiche vers le bas ; cela arrivait aussi sur ordinateur).",
        de: "Korrekturen: Der Punktekauf läuft auf dem Handy nicht mehr über seinen Kasten, und der Druck lässt nach dem ersten Bogen keine leere Seite mehr (der Innenabstand der Seite schob den Bogen nach unten; es trat auch am Computer auf).",
        es: "Correcciones: la compra de puntos ya no se sale de su cuadro en el teléfono, y la impresión ya no deja una página en blanco tras la primera hoja (el relleno de la página empujaba la hoja hacia abajo; también ocurría en ordenador).",
      },
      {
        en: "A backup of all characters: the character menu exports every character in one file and importing it puts them back (what is already there is left alone, a different version of the same character becomes a copy), and it shows when the last backup was made. First visit: a short welcome. On the sheet, tap the name to type another one and tap species, background, level, alignment or class to change them. The Class step says when a subclass is due. A new version of the app is offered with an Update button instead of installing silently.",
        it: "Una copia di sicurezza di tutti i personaggi: il menu del personaggio esporta tutti i personaggi in un file e importandolo li rimette a posto (ciò che c'è già resta com'è, una versione diversa dello stesso personaggio diventa una copia), e mostra quando è stata fatta l'ultima copia. Alla prima visita, un breve benvenuto. Sulla scheda, tocca il nome per scriverne un altro e tocca specie, background, livello, allineamento o classe per cambiarli. Il passo Classe dice quando è dovuta una sottoclasse. Una nuova versione dell'app viene proposta con un pulsante Aggiorna invece di installarsi in silenzio.",
        fr: "Une sauvegarde de tous les personnages : le menu du personnage exporte tous les personnages dans un fichier et l'importer les remet en place (ce qui est déjà là reste tel quel, une version différente du même personnage devient une copie), et il montre quand la dernière sauvegarde a été faite. À la première visite, un court message d'accueil. Sur la fiche, touche le nom pour en saisir un autre et touche espèce, historique, niveau, alignement ou classe pour les changer. L'étape Classe indique quand une sous-classe est due. Une nouvelle version de l'application est proposée avec un bouton Mettre à jour au lieu de s'installer en silence.",
        de: "Eine Sicherung aller Charaktere: Das Charaktermenü exportiert alle Charaktere in eine Datei, und das Importieren stellt sie wieder her (was schon da ist, bleibt, eine abweichende Version desselben Charakters wird zur Kopie), und es zeigt, wann die letzte Sicherung gemacht wurde. Beim ersten Besuch ein kurzer Willkommenstext. Auf dem Bogen tippe den Namen an, um einen anderen einzugeben, und tippe Spezies, Hintergrund, Grad, Gesinnung oder Klasse an, um sie zu ändern. Der Schritt Klasse sagt, wann eine Unterklasse fällig ist. Eine neue Version der App wird mit einem Knopf Aktualisieren angeboten, statt sich still zu installieren.",
        es: "Una copia de seguridad de todos los personajes: el menú del personaje exporta todos los personajes en un archivo e importarlo los devuelve (lo que ya está se deja, una versión distinta del mismo personaje pasa a ser una copia), y muestra cuándo se hizo la última copia. En la primera visita, una breve bienvenida. En la hoja, toca el nombre para escribir otro y toca especie, trasfondo, nivel, alineamiento o clase para cambiarlos. El paso Clase avisa cuando toca una subclase. Una nueva versión de la app se ofrece con un botón Actualizar en lugar de instalarse en silencio.",
      },
      {
        en: "Importing from Aurora files no longer fills the lists with repeats: entries with the same name that say exactly the same are merged, the 2014 version is used when a 2024 one exists (a checkbox keeps both), and the items Aurora keeps for its own books are left out. The import report says how many were merged or left out. The character bar menu now opens on phones too.",
        it: "L'importazione dai file Aurora non riempie più le liste di doppioni: le voci con lo stesso nome che dicono esattamente lo stesso si uniscono, si usa la versione 2014 quando ne esiste una 2024 (una casella le tiene entrambe) e gli oggetti che Aurora tiene per i propri conti restano fuori. Il rapporto dell'importazione dice quante voci sono state unite o lasciate fuori. Il menu della barra dei personaggi ora si apre anche da telefono.",
        fr: "L'import des fichiers Aurora ne remplit plus les listes de doublons : les entrées de même nom qui disent exactement la même chose sont fusionnées, la version 2014 est utilisée quand il en existe une 2024 (une case garde les deux) et les objets qu'Aurora garde pour sa propre comptabilité sont écartés. Le rapport d'import dit combien ont été fusionnées ou écartées. Le menu de la barre des personnages s'ouvre maintenant aussi sur téléphone.",
        de: "Der Import aus Aurora-Dateien füllt die Listen nicht mehr mit Doppelten: Einträge mit gleichem Namen, die genau dasselbe sagen, werden zusammengeführt, die 2014-Version wird genommen, wenn es eine 2024-Version gibt (ein Kästchen behält beide), und die Gegenstände, die Aurora für seine eigene Buchführung hält, bleiben draußen. Der Importbericht nennt, wie viele zusammengeführt oder weggelassen wurden. Das Menü der Charakterleiste öffnet sich jetzt auch auf dem Handy.",
        es: "La importación de archivos de Aurora ya no llena las listas de repetidos: las entradas con el mismo nombre que dicen exactamente lo mismo se fusionan, se usa la versión 2014 cuando existe una 2024 (una casilla conserva ambas) y los objetos que Aurora guarda para su propia contabilidad se dejan fuera. El informe de la importación dice cuántas se fusionaron o se dejaron fuera. El menú de la barra de personajes ahora también se abre en el teléfono.",
      },
      {
        en: "A lighter frame, made for phones: the title and one menu button (settings and every other page, the homebrew editor included) take one line, the character bar fits on one line with the other actions behind a button, the four tabs fit on screen and stay at the top while you scroll, and the pages (packs, about, credits...) no longer carry the bar and the tabs.",
        it: "Una cornice più leggera, pensata per il telefono: titolo e un solo pulsante menu (impostazioni e tutte le altre pagine, editor homebrew compreso) occupano una riga, la barra dei personaggi sta su una riga con le altre azioni dietro un pulsante, le quattro schede stanno nello schermo e restano in alto mentre scorri, e le pagine (pacchetti, info, crediti...) non portano più barra e schede.",
        fr: "Un cadre plus léger, pensé pour le téléphone : le titre et un seul bouton de menu (réglages et toutes les autres pages, éditeur homebrew compris) tiennent sur une ligne, la barre des personnages tient sur une ligne avec les autres actions derrière un bouton, les quatre onglets tiennent à l'écran et restent en haut pendant le défilement, et les pages (paquets, infos, crédits...) n'ont plus la barre ni les onglets.",
        de: "Ein schlankerer Rahmen, gemacht fürs Handy: Titel und ein Menüknopf (Einstellungen und alle anderen Seiten, auch der Homebrew-Editor) brauchen eine Zeile, die Charakterleiste passt in eine Zeile mit den übrigen Aktionen hinter einem Knopf, die vier Reiter passen auf den Bildschirm und bleiben beim Scrollen oben, und die Seiten (Pakete, Info, Danksagung...) tragen Leiste und Reiter nicht mehr.",
        es: "Un marco más ligero, pensado para el teléfono: el título y un solo botón de menú (ajustes y todas las demás páginas, el editor homebrew incluido) ocupan una línea, la barra de personajes cabe en una línea con las otras acciones tras un botón, las cuatro pestañas caben en pantalla y se quedan arriba al desplazarte, y las páginas (paquetes, info, créditos...) ya no llevan barra ni pestañas.",
      },
      {
        en: 'The character list says who is who ("Elowen · Wizard 3"), deleting no longer asks with a browser box: it deletes at once and offers Undo for a few seconds, and in Build on a phone the numbers (armor class, hit points, initiative, ability scores) sit in a strip at the top.',
        it: 'L\'elenco dei personaggi dice chi è chi ("Elowen · Mago 3"), eliminare non chiede più con una finestra del browser: elimina subito e offre Annulla per qualche secondo, e in Crea da telefono i numeri (classe armatura, punti ferita, iniziativa, caratteristiche) stanno in una striscia in alto.',
        fr: "La liste des personnages dit qui est qui (« Elowen · Magicien 3 »), supprimer ne demande plus avec une fenêtre du navigateur : cela supprime aussitôt et propose Annuler pendant quelques secondes, et dans Créer sur téléphone les chiffres (classe d'armure, points de vie, initiative, caractéristiques) tiennent dans une bande en haut.",
        de: 'Die Charakterliste sagt, wer wer ist ("Elowen · Magier 3"), Löschen fragt nicht mehr mit einem Browserfenster: Es löscht sofort und bietet einige Sekunden lang Rückgängig an, und in Erstellen auf dem Handy stehen die Zahlen (Rüstungsklasse, Trefferpunkte, Initiative, Attribute) in einem Streifen oben.',
        es: 'La lista de personajes dice quién es quién ("Elowen · Mago 3"), eliminar ya no pregunta con una ventana del navegador: elimina al instante y ofrece Deshacer unos segundos, y en Crear en el teléfono los números (clase de armadura, puntos de golpe, iniciativa, características) van en una franja arriba.',
      },
      {
        en: "In Play, quick buttons change hit points by 1, 5 or 10, and the lines you tap to open (traits, features) and the small labels of the sheet are bigger, to be easier to hit and to read.",
        it: "In Gioca, pulsanti rapidi cambiano i punti ferita di 1, 5 o 10, e le righe che si toccano per aprire (tratti, privilegi) e le piccole etichette della scheda sono più grandi, per toccarle e leggerle meglio.",
        fr: "Dans Jouer, des boutons rapides changent les points de vie de 1, 5 ou 10, et les lignes à toucher pour ouvrir (traits, aptitudes) et les petites étiquettes de la fiche sont plus grandes, pour être plus faciles à toucher et à lire.",
        de: "In Spielen ändern Schnellknöpfe die Trefferpunkte um 1, 5 oder 10, und die Zeilen zum Aufklappen (Merkmale) sowie die kleinen Beschriftungen des Bogens sind größer, besser zu treffen und zu lesen.",
        es: "En Jugar, botones rápidos cambian los puntos de golpe en 1, 5 o 10, y las líneas que se tocan para abrir (rasgos) y las etiquetas pequeñas de la hoja son más grandes, para tocarlas y leerlas mejor.",
      },
    ],
  },
  {
    version: "1.1 beta",
    date: "2026-10-21",
    notes: [
      {
        en: "Magic items can be added to the character in the Equipment step, and what they give counts while they are equipped: bonuses to armor class, saving throws, initiative and speed, ability scores (a belt that sets Strength to 21), resistances, languages and proficiencies. More than three items that need attunement give a warning.",
        it: "Gli oggetti magici si aggiungono al personaggio nel passo Equipaggiamento e ciò che danno conta finché sono equipaggiati: bonus a classe armatura, tiri salvezza, iniziativa e velocità, punteggi di caratteristica (una cintura che porta la Forza a 21), resistenze, linguaggi e competenze. Più di tre oggetti che richiedono sintonia danno un avviso.",
        fr: "Les objets magiques s'ajoutent au personnage à l'étape Équipement et ce qu'ils apportent compte tant qu'ils sont équipés : bonus à la classe d'armure, aux jets de sauvegarde, à l'initiative et à la vitesse, valeurs de caractéristique (une ceinture qui porte la Force à 21), résistances, langues et maîtrises. Plus de trois objets demandant une harmonisation donnent un avertissement.",
        de: "Magische Gegenstände lassen sich im Schritt Ausrüstung hinzufügen, und was sie geben, zählt, solange sie angelegt sind: Boni auf Rüstungsklasse, Rettungswürfe, Initiative und Bewegungsrate, Attributswerte (ein Gürtel, der Stärke auf 21 setzt), Resistenzen, Sprachen und Übungen. Mehr als drei Gegenstände mit Einstimmung geben eine Warnung.",
        es: "Los objetos mágicos se añaden al personaje en el paso Equipo y lo que dan cuenta mientras están equipados: bonos a la clase de armadura, tiradas de salvación, iniciativa y velocidad, puntuaciones de característica (un cinturón que lleva la Fuerza a 21), resistencias, idiomas y competencias. Más de tres objetos que requieren sintonización dan un aviso.",
      },
      {
        en: 'Race variants from Aurora files now work: the half-elf of the Sword Coast, the dragonborn of Wildemount, the races of the dragonmarks of Eberron and others are picked as a subspecies that replaces what the race gives (and what the base race loses is taken away). Requirements written as "not any of these" are read correctly now.',
        it: 'Le varianti di razza dei file Aurora ora funzionano: il mezzelfo della Costa della Spada, il dragonide di Wildemount, le razze dei marchi del drago di Eberron e altre si scelgono come sottospecie che sostituisce ciò che la razza dà (e ciò che la razza base perde viene tolto). I requisiti scritti come "nessuno di questi" ora sono letti correttamente.',
        fr: "Les variantes de race des fichiers Aurora fonctionnent désormais : le demi-elfe de la Côte des Épées, le drakéide de Wildemount, les races des marques du dragon d'Eberron et d'autres se choisissent comme sous-espèce qui remplace ce que la race apporte (et ce que la race de base perd est retiré). Les conditions écrites « aucun de ceux-ci » sont maintenant lues correctement.",
        de: 'Rassenvarianten aus Aurora-Dateien funktionieren jetzt: der Halbelf der Schwertküste, der Drachenblütige aus Wildemount, die Rassen der Drachenmale von Eberron und weitere werden als Unterspezies gewählt, die ersetzt, was die Rasse gibt (und was die Grundrasse verliert, entfällt). Voraussetzungen der Art "keines davon" werden jetzt richtig gelesen.',
        es: "Las variantes de raza de los archivos de Aurora ya funcionan: el semielfo de la Costa de la Espada, el dracónido de Wildemount, las razas de las marcas del dragón de Eberron y otras se eligen como subespecie que sustituye lo que da la raza (y lo que pierde la raza base se quita). Los requisitos escritos como «ninguno de estos» ahora se leen bien.",
      },
      {
        en: "More of what Aurora files say now works: the feat a race or background lets you pick (Custom Lineage and the customised origins of Tasha), resistances, immunities and vulnerabilities (listed on the sheet, and given by the SRD's dwarves, tieflings and dragonborn), spells picked by school or level, and groups of tools to choose from.",
        it: "Altro di ciò che dicono i file Aurora ora funziona: il talento che una razza o un background fa scegliere (Stirpe personalizzata e origini personalizzate di Tasha), resistenze, immunità e vulnerabilità (elencate in scheda, e date da nani, tiefling e dragonidi dell'SRD), incantesimi scelti per scuola o livello e gruppi di strumenti tra cui scegliere.",
        fr: "Davantage de ce que disent les fichiers Aurora fonctionne : le don qu'une race ou un historique fait choisir (Lignage personnalisé et origines personnalisées de Tasha), résistances, immunités et vulnérabilités (listées sur la fiche, et données par les nains, tieflings et drakéides du SRD), sorts choisis par école ou niveau, et groupes d'outils à choisir.",
        de: "Mehr von dem, was Aurora-Dateien sagen, funktioniert jetzt: das Talent, das eine Rasse oder ein Hintergrund wählen lässt (Benutzerdefinierte Abstammung und angepasste Herkünfte aus Tasha), Resistenzen, Immunitäten und Verwundbarkeiten (auf dem Bogen aufgeführt, und von den Zwergen, Tieflingen und Drachenblütigen des SRD gegeben), nach Schule oder Grad gewählte Zauber und Werkzeuggruppen zur Auswahl.",
        es: "Más de lo que dicen los archivos de Aurora ya funciona: la dote que una raza o trasfondo deja elegir (Linaje personalizado y orígenes personalizados de Tasha), resistencias, inmunidades y vulnerabilidades (listadas en la hoja, y dadas por los enanos, tieflings y dracónidos del SRD), conjuros elegidos por escuela o nivel y grupos de herramientas entre los que elegir.",
      },
      {
        en: "Aurora imports: the custom ability score increase of Tasha's Custom Lineage (and other customised origins) is now a choice you make, instead of being lost.",
        it: "Importazioni Aurora: l'aumento di caratteristica personalizzato della Stirpe personalizzata di Tasha (e delle altre origini personalizzate) ora è una scelta da fare, invece di andare perso.",
        fr: "Imports Aurora : l'augmentation de caractéristique personnalisée du Lignage personnalisé de Tasha (et des autres origines personnalisées) est maintenant un choix à faire, au lieu d'être perdue.",
        de: "Aurora-Importe: Die frei wählbare Attributserhöhung von Tashas Benutzerdefinierter Abstammung (und anderer angepasster Herkünfte) ist jetzt eine Auswahl, statt verloren zu gehen.",
        es: "Importaciones de Aurora: el aumento de característica personalizado del Linaje personalizado de Tasha (y de otros orígenes personalizados) ahora es una elección, en lugar de perderse.",
      },
      {
        en: "The Origin and Class steps use the width of a computer screen: the menus stay on the left and, on the right, what the chosen species, background, class and subclass give (size, speed, proficiencies, traits and features, each one tap away). On phones and tablets the two parts stack.",
        it: "I passi Origine e Classe sfruttano la larghezza di uno schermo da computer: i menu restano a sinistra e a destra compare cosa danno la specie, il background, la classe e la sottoclasse scelti (taglia, velocità, competenze, tratti e privilegi, ognuno a un tocco). Su telefono e tablet le due parti si impilano.",
        fr: "Les étapes Origine et Classe profitent de la largeur d'un écran d'ordinateur : les menus restent à gauche et, à droite, ce qu'apportent l'espèce, l'historique, la classe et la sous-classe choisis (taille, vitesse, maîtrises, traits et aptitudes, chacun à portée d'un toucher). Sur téléphone et tablette, les deux parties s'empilent.",
        de: "Die Schritte Herkunft und Klasse nutzen die Breite eines Computerbildschirms: Die Menüs bleiben links, rechts steht, was die gewählte Spezies, der Hintergrund, die Klasse und die Unterklasse geben (Größe, Bewegungsrate, Übungen, Merkmale, jeweils mit einem Tipp erreichbar). Auf Handy und Tablet werden die beiden Teile untereinander gestellt.",
        es: "Los pasos Origen y Clase aprovechan el ancho de una pantalla de ordenador: los menús quedan a la izquierda y, a la derecha, lo que dan la especie, el trasfondo, la clase y la subclase elegidos (tamaño, velocidad, competencias, rasgos, cada uno a un toque). En teléfono y tableta las dos partes se apilan.",
      },
      {
        en: "Aurora Legacy: the whole collection (about 750 files) can be imported in one go. Magic items (rarity and attunement, the rules stay in the text) and deities (picked in the Story step) are now read, sub-races and subclasses that were left out (Artificer, Genasi, Shifter, Merfolk...) find their race or class, and definitions such as sources, proficiencies and flags are no longer reported as unsupported.",
        it: "Aurora Legacy: l'intera raccolta (circa 750 file) si importa in un colpo solo. Ora si leggono gli oggetti magici (rarità e sintonia, le regole restano nel testo) e le divinità (da scegliere nel passo Storia), le sottorazze e sottoclassi che restavano fuori (Artefice, Genasi, Mutaforma, Tritoni...) trovano la loro razza o classe, e definizioni come fonti, competenze e segnalatori non vengono più indicate come non supportate.",
        fr: "Aurora Legacy : toute la collection (environ 750 fichiers) s'importe en une fois. Les objets magiques (rareté et harmonisation, les règles restent dans le texte) et les divinités (à choisir à l'étape Histoire) sont lus, les sous-races et sous-classes laissées de côté (Artificier, Génasi, Changeforme, Homme-poisson...) retrouvent leur race ou classe, et les définitions comme les sources, maîtrises et marqueurs ne sont plus signalées comme non prises en charge.",
        de: "Aurora Legacy: Die ganze Sammlung (etwa 750 Dateien) lässt sich auf einmal importieren. Magische Gegenstände (Seltenheit und Einstimmung, die Regeln bleiben im Text) und Gottheiten (im Schritt Geschichte wählbar) werden gelesen, bisher ausgelassene Unterrassen und Unterklassen (Artifizier, Dschinn-Abkömmlinge, Gestaltwandler, Meervolk...) finden ihre Rasse oder Klasse, und Definitionen wie Quellen, Übungen und Marker werden nicht mehr als nicht unterstützt gemeldet.",
        es: "Aurora Legacy: toda la colección (unos 750 archivos) se importa de una vez. Ya se leen los objetos mágicos (rareza y sintonización, las reglas quedan en el texto) y las deidades (se eligen en el paso Historia), las subrazas y subclases que quedaban fuera (Artífice, Genasi, Cambiapieles, Tritones...) encuentran su raza o clase, y las definiciones como fuentes, competencias y marcas ya no se señalan como no admitidas.",
      },
      {
        en: "Class features that change numbers now work: fighting styles (Archery, Defense, Dueling), Unarmored Defense for barbarians, monks and draconic sorcerers, Fast Movement, and hit points per level (Draconic Resilience, Dwarven Toughness).",
        it: "I privilegi di classe che cambiano dei numeri ora funzionano: stili di combattimento (Tiro, Difesa, Duellare), Difesa senza armatura di barbari, monaci e stregoni draconici, Movimento veloce e punti ferita per livello (Resilienza draconica, Robustezza nanica).",
        fr: "Les aptitudes de classe qui changent des chiffres fonctionnent désormais : styles de combat (Tir, Défense, Duel), Défense sans armure des barbares, moines et ensorceleurs draconiques, Déplacement rapide et points de vie par niveau (Résilience draconique, Robustesse naine).",
        de: "Klassenmerkmale, die Zahlen ändern, funktionieren jetzt: Kampfstile (Bogenschießen, Verteidigung, Duellieren), Ungepanzerte Verteidigung von Barbaren, Mönchen und Drachenzauberern, Schnelle Bewegung und Trefferpunkte pro Grad (Drachenresistenz, Zwergische Zähigkeit).",
        es: "Los rasgos de clase que cambian números ya funcionan: estilos de combate (Tiro, Defensa, Duelo), Defensa sin armadura de bárbaros, monjes y hechiceros dracónicos, Movimiento rápido y puntos de golpe por nivel (Resistencia dracónica, Dureza enana).",
      },
      {
        en: "More features work: Expertise, Jack of All Trades, Remarkable Athlete, Unarmored Movement, and the options of eldritch invocations (with the spells they grant), pact boons, metamagic, Hunter's Prey and the other options of class features, picked as the class grows.",
        it: "Funzionano altri privilegi: Maestria, Factotum, Atleta straordinario, Movimento senza armatura e le opzioni di suppliche occulte (con gli incantesimi che concedono), doni del patto, metamagia, Preda del cacciatore e le altre opzioni dei privilegi di classe, da scegliere man mano che la classe cresce.",
        fr: "D'autres aptitudes fonctionnent : Expertise, Touche-à-tout, Athlète remarquable, Déplacement sans armure, et les options des manifestations occultes (avec les sorts qu'elles accordent), des dons de pacte, de la métamagie, de la Proie du chasseur et des autres aptitudes de classe, à choisir au fil de la progression.",
        de: "Weitere Merkmale funktionieren: Expertise, Tausendsassa, Bemerkenswerter Athlet, Ungepanzerte Bewegung und die Optionen von Schauerlichen Anrufungen (mit den Zaubern, die sie gewähren), Paktgaben, Metamagie, Beute des Jägers und anderer Klassenmerkmale, gewählt, während die Klasse wächst.",
        es: "Funcionan más rasgos: Pericia, Aprendiz de todo, Atleta extraordinario, Movimiento sin armadura y las opciones de invocaciones sobrenaturales (con los conjuros que otorgan), dones del pacto, metamagia, Presa del cazador y otras opciones de rasgos de clase, que se eligen según crece la clase.",
      },
      {
        en: "Subclass spells: the Circle of the Land picks its terrain and gets that terrain's spells by level, a warlock patron adds its spells to the list to pick from, and the Life domain has its missing spell. Subclasses can now give spellcasting (Eldritch Knight, Arcane Trickster) in Aurora imports and in the homebrew editor.",
        it: "Incantesimi di sottoclasse: il Circolo della terra sceglie il suo terreno e ottiene gli incantesimi di quel terreno per livello, un patrono del warlock aggiunge i suoi incantesimi alla lista da cui scegliere, e il dominio della Vita ha il suo incantesimo mancante. Le sottoclassi ora possono dare il lancio di incantesimi (Cavaliere Mistico, Mistificatore Arcano) nelle importazioni Aurora e nell'editor homebrew.",
        fr: "Sorts de sous-classe : le Cercle de la Terre choisit son terrain et reçoit les sorts de ce terrain par niveau, un protecteur d'occultiste ajoute ses sorts à la liste de choix, et le domaine de la Vie retrouve son sort manquant. Les sous-classes peuvent désormais donner la magie (Chevalier occulte, Escroc arcanique) dans les imports Aurora et l'éditeur homebrew.",
        de: "Unterklassenzauber: Der Zirkel des Landes wählt sein Gelände und erhält dessen Zauber nach Grad, ein Hexenmeister-Schutzherr fügt seine Zauber der Auswahlliste hinzu, und die Domäne des Lebens bekommt ihren fehlenden Zauber. Unterklassen können jetzt Zauberwirken geben (Mystischer Ritter, Arkaner Betrüger), in Aurora-Importen und im Homebrew-Editor.",
        es: "Conjuros de subclase: el Círculo de la Tierra elige su terreno y recibe los conjuros de ese terreno por nivel, un patrón de brujo añade sus conjuros a la lista de elección, y el dominio de la Vida recupera su conjuro que faltaba. Las subclases ahora pueden dar lanzamiento de conjuros (Caballero sobrenatural, Embaucador arcano) en las importaciones de Aurora y en el editor homebrew.",
      },
      {
        en: "A fighting style is a choice in the Choices step and in level up, and the sheet lists where each bonus comes from.",
        it: "Lo stile di combattimento è una scelta nel passo Scelte e nel level up, e la scheda elenca da dove viene ogni bonus.",
        fr: "Le style de combat est un choix à l'étape Choix et à la montée de niveau, et la fiche indique d'où vient chaque bonus.",
        de: "Ein Kampfstil ist eine Wahl im Schritt Entscheidungen und beim Stufenaufstieg, und der Bogen zeigt, woher jeder Bonus kommt.",
        es: "El estilo de combate es una elección en el paso Elecciones y en la subida de nivel, y la hoja indica de dónde viene cada bonificador.",
      },
      {
        en: "Entries from different books that share a name now show their book in brackets when imported from Aurora.",
        it: "Le voci di libri diversi con lo stesso nome ora mostrano il libro tra parentesi quando vengono importate da Aurora.",
        fr: "Les entrées de livres différents qui portent le même nom affichent désormais leur livre entre parenthèses à l'import depuis Aurora.",
        de: "Einträge aus verschiedenen Büchern mit gleichem Namen zeigen beim Aurora-Import jetzt ihr Buch in Klammern.",
        es: "Las entradas de libros distintos con el mismo nombre ahora muestran su libro entre paréntesis al importarlas desde Aurora.",
      },
    ],
  },
  {
    version: "1.0 beta",
    date: "2026-10-19",
    notes: [
      {
        en: "Guided character building with the SRD 5.1 rules, and a Free edit step to override any number.",
        it: "Creazione guidata del personaggio con le regole dell'SRD 5.1, e un passo di Modifica libera per forzare qualsiasi valore.",
        fr: "Création guidée du personnage avec les règles du SRD 5.1, et une étape d'édition libre pour forcer n'importe quelle valeur.",
        de: "Geführte Charaktererstellung mit den Regeln des SRD 5.1 und ein Schritt für freie Bearbeitung, um jeden Wert zu überschreiben.",
        es: "Creación guiada del personaje con las reglas del SRD 5.1 y un paso de edición libre para forzar cualquier valor.",
      },
      {
        en: "Multiclassing, feats, level up with a celebration, and the story fields of the sheet.",
        it: "Multiclasse, talenti, level up con una piccola festa e i campi di storia della scheda.",
        fr: "Multiclassage, dons, montée de niveau avec une petite célébration et les champs d'histoire de la fiche.",
        de: "Multiklassen, Talente, Stufenaufstieg mit kleiner Feier und die Geschichtsfelder des Bogens.",
        es: "Multiclase, dotes, subida de nivel con una pequeña celebración y los campos de historia de la hoja.",
      },
      {
        en: "Play mode: hit points, rests, spell slots, Pact Magic, class resources, concentration, rolls and conditions.",
        it: "Modalità gioco: punti ferita, riposi, slot incantesimo, Magia del Patto, risorse di classe, concentrazione, tiri e condizioni.",
        fr: "Mode jeu : points de vie, repos, emplacements de sorts, Magie de pacte, ressources de classe, concentration, jets et états.",
        de: "Spielmodus: Trefferpunkte, Rasten, Zauberplätze, Paktmagie, Klassenressourcen, Konzentration, Würfe und Zustände.",
        es: "Modo de juego: puntos de golpe, descansos, espacios de conjuro, Magia de pacto, recursos de clase, concentración, tiradas y condiciones.",
      },
      {
        en: "Printing: character sheet, spell sheets and spell cards, for paper or PDF.",
        it: "Stampa: scheda del personaggio, schede degli incantesimi e carte degli incantesimi, su carta o in PDF.",
        fr: "Impression : fiche de personnage, fiches de sorts et cartes de sorts, sur papier ou en PDF.",
        de: "Druck: Charakterbogen, Zauberblätter und Zauberkarten, auf Papier oder als PDF.",
        es: "Impresión: hoja de personaje, hojas de hechizos y cartas de hechizos, en papel o PDF.",
      },
      {
        en: "Sharing: a link, a QR code or a file; a shared link opens the character on another device.",
        it: "Condivisione: un link, un codice QR o un file; un link condiviso apre il personaggio su un altro dispositivo.",
        fr: "Partage : un lien, un code QR ou un fichier ; un lien partagé ouvre le personnage sur un autre appareil.",
        de: "Teilen: ein Link, ein QR-Code oder eine Datei; ein geteilter Link öffnet den Charakter auf einem anderen Gerät.",
        es: "Compartir: un enlace, un código QR o un archivo; un enlace compartido abre el personaje en otro dispositivo.",
      },
      {
        en: "Content packs: a homebrew editor (spells, items, feats, species, backgrounds, classes, subclasses) and an importer for Aurora files, by file, index or address.",
        it: "Pacchetti di contenuti: un editor homebrew (incantesimi, oggetti, talenti, specie, background, classi, sottoclassi) e un importatore di file Aurora, da file, indice o indirizzo.",
        fr: "Paquets de contenu : un éditeur homebrew (sorts, objets, dons, espèces, historiques, classes, sous-classes) et un importateur de fichiers Aurora, par fichier, index ou adresse.",
        de: "Inhaltspakete: ein Homebrew-Editor (Zauber, Gegenstände, Talente, Völker, Hintergründe, Klassen, Unterklassen) und ein Importer für Aurora-Dateien, per Datei, Index oder Adresse.",
        es: "Paquetes de contenido: un editor homebrew (hechizos, objetos, dotes, especies, trasfondos, clases, subclases) y un importador de archivos de Aurora, por archivo, índice o dirección.",
      },
      {
        en: "Five languages (English, Italian, French, German, Spanish) with the official SRD translations, about 87% of the rules texts.",
        it: "Cinque lingue (inglese, italiano, francese, tedesco, spagnolo) con le traduzioni ufficiali dell'SRD, circa l'87% dei testi delle regole.",
        fr: "Cinq langues (anglais, italien, français, allemand, espagnol) avec les traductions officielles du SRD, environ 87 % des textes de règles.",
        de: "Fünf Sprachen (Englisch, Italienisch, Französisch, Deutsch, Spanisch) mit den offiziellen SRD-Übersetzungen, etwa 87 % der Regeltexte.",
        es: "Cinco idiomas (inglés, italiano, francés, alemán, español) con las traducciones oficiales del SRD, cerca del 87 % de los textos de reglas.",
      },
      {
        en: "Automatic translation of the texts that have none yet, with your own DeepL key, and metric units.",
        it: "Traduzione automatica dei testi che non ne hanno ancora una, con la tua chiave DeepL, e unità metriche.",
        fr: "Traduction automatique des textes qui n'en ont pas encore, avec ta propre clé DeepL, et unités métriques.",
        de: "Automatische Übersetzung der Texte, die noch keine haben, mit deinem eigenen DeepL-Schlüssel, und metrische Einheiten.",
        es: "Traducción automática de los textos que aún no tienen una, con tu propia clave de DeepL, y unidades métricas.",
      },
      {
        en: "Two styles (Fantasy and Modern), light and dark, and it works offline once opened.",
        it: "Due stili (Fantasy e Moderno), chiaro e scuro, e funziona offline una volta aperta.",
        fr: "Deux styles (Fantasy et Moderne), clair et sombre, et fonctionne hors ligne une fois ouverte.",
        de: "Zwei Stile (Fantasy und Modern), hell und dunkel, und nach dem ersten Öffnen offline nutzbar.",
        es: "Dos estilos (Fantasía y Moderno), claro y oscuro, y funciona sin conexión una vez abierta.",
      },
    ],
  },
];

export interface RoadmapItem {
  id: string;
  text: Translated;
}

/** What is still missing, from the nearest to the furthest. */
export const ROADMAP: RoadmapItem[] = [
  {
    id: "testing",
    text: {
      en: "More testing, on more devices and with more kinds of characters: this is a beta.",
      it: "Più prove, su più dispositivi e con più tipi di personaggi: questa è una beta.",
      fr: "Plus de tests, sur plus d'appareils et avec plus de types de personnages : c'est une bêta.",
      de: "Mehr Tests, auf mehr Geräten und mit mehr Arten von Charakteren: Das ist eine Beta.",
      es: "Más pruebas, en más dispositivos y con más tipos de personajes: esto es una beta.",
    },
  },
  {
    id: "translations",
    text: {
      en: "The remaining translations: about 170 items, the proficiencies and a few class options. Automatic translation fills them meanwhile.",
      it: "Le traduzioni che mancano: circa 170 oggetti, le competenze e alcune opzioni di classe. Nel frattempo la traduzione automatica le riempie.",
      fr: "Les traductions manquantes : environ 170 objets, les maîtrises et quelques options de classe. La traduction automatique les comble en attendant.",
      de: "Die fehlenden Übersetzungen: etwa 170 Gegenstände, die Übungen und einige Klassenoptionen. Die automatische Übersetzung füllt sie in der Zwischenzeit.",
      es: "Las traducciones que faltan: unos 170 objetos, las competencias y algunas opciones de clase. La traducción automática las cubre mientras tanto.",
    },
  },
  {
    id: "spellRolls",
    text: {
      en: "Spell attack and damage rolls in Play, with the dice for the slot used.",
      it: "Tiri per colpire e per i danni degli incantesimi in Gioca, con i dadi del livello di slot usato.",
      fr: "Jets d'attaque et de dégâts des sorts dans Jouer, avec les dés de l'emplacement utilisé.",
      de: "Angriffs- und Schadenswürfe von Zaubern im Spielmodus, mit den Würfeln des verwendeten Zauberplatzes.",
      es: "Tiradas de ataque y de daño de los conjuros en Jugar, con los dados del espacio usado.",
    },
  },
  {
    id: "rules2024",
    text: {
      en: "The 2024 rules (SRD 5.2.1), next to the 2014 ones.",
      it: "Le regole 2024 (SRD 5.2.1), accanto a quelle del 2014.",
      fr: "Les règles 2024 (SRD 5.2.1), à côté de celles de 2014.",
      de: "Die Regeln von 2024 (SRD 5.2.1), neben denen von 2014.",
      es: "Las reglas de 2024 (SRD 5.2.1), junto a las de 2014.",
    },
  },
  {
    id: "features",
    text: {
      en: "Features that depend on dice, reactions or spell damage (Great Weapon Fighting, Two-Weapon Fighting, Agonizing Blast, Divine Smite) are still only text: use Free edit for their effects.",
      it: "I privilegi che dipendono da dadi, reazioni o danni degli incantesimi (Combattere con armi possenti, Combattere con due armi, Deflagrazione agonizzante, Punizione divina) per ora sono solo testo: usa la Modifica libera per i loro effetti.",
      fr: "Les aptitudes qui dépendent des dés, des réactions ou des dégâts de sorts (Armes à deux mains, Combat à deux armes, Décharge déchirante, Châtiment divin) ne sont encore que du texte : utilise l'édition libre pour leurs effets.",
      de: "Merkmale, die von Würfeln, Reaktionen oder Zauberschaden abhängen (Kampf mit großen Waffen, Zwei-Waffen-Kampf, Qualvoller Strahl, Göttliches Niederstrecken), sind vorerst nur Text: Nutze für ihre Wirkung die freie Bearbeitung.",
      es: "Los rasgos que dependen de dados, reacciones o daño de conjuros (Combate con armas a dos manos, Combate con dos armas, Descarga agónica, Castigo divino) por ahora son solo texto: usa la edición libre para sus efectos.",
    },
  },
  {
    id: "casters",
    text: {
      en: "The Eldritch Knight and Arcane Trickster are not in the SRD: they come from Aurora files or the homebrew editor. Their spell lists are not limited to the schools the rules ask for.",
      it: "Il Cavaliere Mistico e il Mistificatore Arcano non sono nell'SRD: arrivano da file Aurora o dall'editor homebrew. Le loro liste di incantesimi non sono limitate alle scuole che le regole richiedono.",
      fr: "Le Chevalier occulte et l'Escroc arcanique ne sont pas dans le SRD : ils viennent de fichiers Aurora ou de l'éditeur homebrew. Leurs listes de sorts ne sont pas limitées aux écoles que demandent les règles.",
      de: "Der Mystische Ritter und der Arkane Betrüger stehen nicht im SRD: Sie kommen aus Aurora-Dateien oder dem Homebrew-Editor. Ihre Zauberlisten sind nicht auf die Schulen beschränkt, die die Regeln verlangen.",
      es: "El Caballero sobrenatural y el Embaucador arcano no están en el SRD: llegan de archivos de Aurora o del editor homebrew. Sus listas de conjuros no se limitan a las escuelas que piden las reglas.",
    },
  },
  {
    id: "aurora",
    text: {
      en: "More of Aurora: companions and background variants are not read yet, and rules that need custom logic keep only their text.",
      it: "Più Aurora: compagni e varianti di background non vengono ancora letti, e le regole che richiedono logica propria restano solo testo.",
      fr: "Plus d'Aurora : compagnons et variantes d'historiques ne sont pas encore lus, et les règles qui demandent une logique propre restent du texte.",
      de: "Mehr Aurora: Gefährten und Varianten von Hintergründen werden noch nicht gelesen, und Regeln mit eigener Logik bleiben nur Text.",
      es: "Más Aurora: los compañeros y variantes de trasfondos aún no se leen, y las reglas que necesitan lógica propia solo conservan su texto.",
    },
  },
  {
    id: "items",
    text: {
      en: "More of what magic items do on the sheet (weapon bonuses, charges, attunement slots), coins and carried weight.",
      it: "Altro di ciò che fanno gli oggetti magici sulla scheda (bonus alle armi, cariche, posti di sintonia), monete e peso trasportato.",
      fr: "Plus de ce que font les objets magiques sur la fiche (bonus d'armes, charges, places d'harmonisation), pièces et poids porté.",
      de: "Mehr davon, was magische Gegenstände auf dem Bogen bewirken (Waffenboni, Ladungen, Einstimmungsplätze), Münzen und Traglast.",
      es: "Más de lo que hacen los objetos mágicos en la hoja (bonos de armas, cargas, ranuras de sintonización), monedas y peso transportado.",
    },
  },
  {
    id: "homebrew",
    text: {
      en: "A richer homebrew editor: effects of features, subclass spells and more kinds of entries.",
      it: "Un editor homebrew più ricco: effetti dei privilegi, incantesimi di sottoclasse e più tipi di voci.",
      fr: "Un éditeur homebrew plus riche : effets des aptitudes, sorts de sous-classe et plus de types d'entrées.",
      de: "Ein reicherer Homebrew-Editor: Wirkungen von Merkmalen, Unterklassen-Zauber und mehr Arten von Einträgen.",
      es: "Un editor homebrew más completo: efectos de los rasgos, hechizos de subclase y más tipos de entradas.",
    },
  },
  {
    id: "auroraCharacters",
    text: {
      en: "Opening the characters saved by Aurora, to move to this app without starting over.",
      it: "Aprire i personaggi salvati da Aurora, per passare a questa app senza ricominciare da capo.",
      fr: "Ouvrir les personnages enregistrés par Aurora, pour passer à cette application sans repartir de zéro.",
      de: "Die von Aurora gespeicherten Charaktere öffnen, um ohne Neustart zu dieser App zu wechseln.",
      es: "Abrir los personajes guardados por Aurora, para pasar a esta app sin empezar de cero.",
    },
  },
  {
    id: "quality",
    text: {
      en: "Automatic visual tests of the screens and an accessibility review (keyboard, screen readers, contrast, larger text).",
      it: "Prove visive automatiche delle schermate e una revisione dell'accessibilità (tastiera, lettori di schermo, contrasto, testo ingrandito).",
      fr: "Des tests visuels automatiques des écrans et une revue de l'accessibilité (clavier, lecteurs d'écran, contraste, texte agrandi).",
      de: "Automatische visuelle Tests der Bildschirme und eine Barrierefreiheitsprüfung (Tastatur, Screenreader, Kontrast, größerer Text).",
      es: "Pruebas visuales automáticas de las pantallas y una revisión de la accesibilidad (teclado, lectores de pantalla, contraste, texto ampliado).",
    },
  },
  {
    id: "dm",
    text: {
      en: "Tools for the Game Master: a bestiary with the SRD monsters, an initiative tracker, animal companions and wild shapes.",
      it: "Strumenti per il Master: un bestiario con i mostri dell'SRD, un tracciatore di iniziativa, compagni animali e forme selvatiche.",
      fr: "Des outils pour le MJ : un bestiaire avec les monstres du SRD, un suivi d'initiative, des compagnons animaux et des formes sauvages.",
      de: "Werkzeuge für den Spielleiter: ein Bestiarium mit den SRD-Monstern, ein Initiative-Tracker, Tiergefährten und Tiergestalten.",
      es: "Herramientas para el Director de Juego: un bestiario con los monstruos del SRD, un registro de iniciativa, compañeros animales y formas salvajes.",
    },
  },
];

/** A text in the wanted language, or in English where it has not been written. */
export function pick(text: Translated, language: string): string {
  return (text as Record<string, string | undefined>)[language] ?? text.en;
}
