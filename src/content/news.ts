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
    version: "1.1 beta",
    date: "2026-10-20",
    notes: [
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
    id: "backup",
    text: {
      en: "A backup of all your characters in one file (export everything, import everything): they live only in this browser for now.",
      it: "Una copia di sicurezza di tutti i personaggi in un solo file (esporta tutto, importa tutto): per ora vivono solo in questo browser.",
      fr: "Une sauvegarde de tous tes personnages dans un seul fichier (tout exporter, tout importer) : pour l'instant ils ne vivent que dans ce navigateur.",
      de: "Eine Sicherung aller Charaktere in einer Datei (alles exportieren, alles importieren): Sie liegen vorerst nur in diesem Browser.",
      es: "Una copia de seguridad de todos los personajes en un solo archivo (exportar todo, importar todo): por ahora viven solo en este navegador.",
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
      en: "More of Aurora: magic items, companions and deities are not read yet, and rules that need custom logic keep only their text.",
      it: "Più Aurora: oggetti magici, compagni e divinità non vengono ancora letti, e le regole che richiedono logica propria restano solo testo.",
      fr: "Plus d'Aurora : objets magiques, compagnons et divinités ne sont pas encore lus, et les règles qui demandent une logique propre restent du texte.",
      de: "Mehr Aurora: Magische Gegenstände, Gefährten und Gottheiten werden noch nicht gelesen, und Regeln mit eigener Logik bleiben nur Text.",
      es: "Más Aurora: los objetos mágicos, compañeros y deidades aún no se leen, y las reglas que necesitan lógica propia solo conservan su texto.",
    },
  },
  {
    id: "items",
    text: {
      en: "Magic items and attunement, coins and carried weight.",
      it: "Oggetti magici e sintonia, monete e peso trasportato.",
      fr: "Objets magiques et harmonisation, pièces et poids porté.",
      de: "Magische Gegenstände und Einstimmung, Münzen und Traglast.",
      es: "Objetos mágicos y sintonización, monedas y peso transportado.",
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
