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
      en: "More class features that change numbers: Expertise, Jack of All Trades, Unarmored Movement, invocations and metamagic are still only text for now: use Free edit for their effects.",
      it: "Altri privilegi di classe che cambiano dei numeri: Maestria, Factotum, Movimento senza armatura, suppliche e metamagia per ora sono ancora solo testo: usa la Modifica libera per i loro effetti.",
      fr: "D'autres aptitudes de classe qui changent des chiffres : Expertise, Touche-à-tout, Déplacement sans armure, manifestations et métamagie ne sont encore que du texte : utilise l'édition libre pour leurs effets.",
      de: "Weitere Klassenmerkmale, die Zahlen ändern: Expertise, Tausendsassa, Ungepanzerte Bewegung, Anrufungen und Metamagie sind vorerst nur Text: Nutze für ihre Wirkung die freie Bearbeitung.",
      es: "Más rasgos de clase que cambian números: Pericia, Aprendiz de todo, Movimiento sin armadura, invocaciones y metamagia por ahora son solo texto: usa la edición libre para sus efectos.",
    },
  },
  {
    id: "casters",
    text: {
      en: "Subclasses that give spellcasting (Eldritch Knight, Arcane Trickster) and the spells that subclasses always prepare.",
      it: "Le sottoclassi che danno incantesimi (Cavaliere Mistico, Mistificatore Arcano) e gli incantesimi che le sottoclassi hanno sempre preparati.",
      fr: "Les sous-classes qui donnent la magie (Chevalier occulte, Escroc arcanique) et les sorts que les sous-classes ont toujours préparés.",
      de: "Unterklassen, die Zauberwirken geben (Mystischer Ritter, Arkaner Betrüger), und die Zauber, die Unterklassen immer vorbereitet haben.",
      es: "Las subclases que dan lanzamiento de hechizos (Caballero sobrenatural, Embaucador arcano) y los hechizos que las subclases siempre tienen preparados.",
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
];

/** A text in the wanted language, or in English where it has not been written. */
export function pick(text: Translated, language: string): string {
  return (text as Record<string, string | undefined>)[language] ?? text.en;
}
