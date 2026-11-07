/**
 * The standard words of a spell's casting time, duration and range ("1 action", "Instantaneous",
 * "Concentration, up to 1 minute", "Touch"), in the languages of the app. Spells that come from
 * other tools are written in English; these few phrases are the same in every book, so they are
 * translated here, with the words the translated SRD uses, without asking a machine. Anything that
 * does not fit exactly (a reaction with its condition, a shape in brackets) is left to the
 * automatic translation.
 */

type Language = "it" | "fr" | "de" | "es";
type Unit = "action" | "bonus action" | "reaction" | "round" | "minute" | "hour" | "day";

/** Each unit in the singular and the plural. */
const UNITS: Record<Language, Record<Unit, [string, string]>> = {
  it: {
    action: ["azione", "azioni"],
    "bonus action": ["azione bonus", "azioni bonus"],
    reaction: ["reazione", "reazioni"],
    round: ["round", "round"],
    minute: ["minuto", "minuti"],
    hour: ["ora", "ore"],
    day: ["giorno", "giorni"],
  },
  fr: {
    action: ["action", "actions"],
    "bonus action": ["action bonus", "actions bonus"],
    reaction: ["réaction", "réactions"],
    round: ["round", "rounds"],
    minute: ["minute", "minutes"],
    hour: ["heure", "heures"],
    day: ["jour", "jours"],
  },
  de: {
    action: ["Aktion", "Aktionen"],
    "bonus action": ["Bonusaktion", "Bonusaktionen"],
    reaction: ["Reaktion", "Reaktionen"],
    round: ["Runde", "Runden"],
    minute: ["Minute", "Minuten"],
    hour: ["Stunde", "Stunden"],
    day: ["Tag", "Tage"],
  },
  es: {
    action: ["acción", "acciones"],
    "bonus action": ["acción adicional", "acciones adicionales"],
    reaction: ["reacción", "reacciones"],
    round: ["asalto", "asaltos"],
    minute: ["minuto", "minutos"],
    hour: ["hora", "horas"],
    day: ["día", "días"],
  },
};

/** The phrases that never change, by the English words in lower case: duration, then range. */
const WORDS: Record<Language, Record<string, string>> = {
  it: {
    instantaneous: "Istantanea",
    special: "Speciale",
    "until dispelled": "Finché non viene dissolto",
    "until dispelled or triggered": "Finché non viene dissolto o innescato",
    self: "Incantatore",
    touch: "Contatto",
    sight: "Vista",
    unlimited: "Illimitata",
  },
  fr: {
    instantaneous: "instantanée",
    special: "spéciale",
    "until dispelled": "jusqu’à dissipation",
    "until dispelled or triggered": "jusqu’à dissipation ou activation",
    self: "personnelle",
    touch: "contact",
    sight: "vision",
    unlimited: "illimitée",
  },
  de: {
    instantaneous: "Unmittelbar",
    special: "Besonders",
    "until dispelled": "Bis der Zauber gebannt wird",
    "until dispelled or triggered": "Bis der Zauber gebannt oder ausgelöst wird",
    self: "Selbst",
    touch: "Berührung",
    sight: "Sicht",
    unlimited: "Unbegrenzt",
  },
  es: {
    instantaneous: "Instantáneo",
    special: "Especial",
    "until dispelled": "Hasta que sea disipado",
    "until dispelled or triggered": "Hasta que sea disipado o se active",
    self: "Lanzador",
    touch: "Toque",
    sight: "Vista",
    unlimited: "Ilimitado",
  },
};

/** "Up to" and "Concentration, up to" before an amount of time. */
const UP_TO: Record<Language, { plain: string; concentration: string }> = {
  it: { plain: "Fino a", concentration: "Concentrazione, fino a" },
  fr: { plain: "jusqu’à", concentration: "concentration, jusqu’à" },
  de: { plain: "Bis zu", concentration: "Konzentration, bis zu" },
  es: { plain: "Hasta", concentration: "Concentración, hasta" },
};

const FIELDS = new Set(["castingTime", "duration", "range"]);
const AMOUNT = /^(\d+) (bonus action|action|reaction|round|minute|hour|day)s?$/;
const UP_TO_AMOUNT = /^(?:(concentration),? )?up to (\d+) (round|minute|hour|day)s?$/;

const amount = (lang: Language, n: number, unit: Unit) =>
  `${n} ${UNITS[lang][unit][n === 1 ? 0 : 1]}`;

/**
 * The text of a casting time, duration or range in the language, if it is one of the standard
 * phrases; undefined otherwise (and for English).
 */
export function spellTerm(field: string, text: string, language: string): string | undefined {
  if (!FIELDS.has(field) || !(language in UNITS)) return undefined;
  const lang = language as Language;
  const t = text.trim().replace(/\.$/, "").replace(/\s+/g, " ").toLowerCase();
  const word = WORDS[lang][t];
  if (word !== undefined) return word;
  if (field === "range") return undefined;
  const plain = AMOUNT.exec(t);
  if (plain) {
    const unit = plain[2] as Unit;
    // A reaction or an action is only a casting time; a duration is a time.
    if (
      field === "duration" &&
      (unit === "action" || unit === "bonus action" || unit === "reaction")
    )
      return undefined;
    return amount(lang, Number(plain[1]), unit);
  }
  const upTo = field === "duration" ? UP_TO_AMOUNT.exec(t) : null;
  if (upTo) {
    const lead = upTo[1] ? UP_TO[lang].concentration : UP_TO[lang].plain;
    return `${lead} ${amount(lang, Number(upTo[2]), upTo[3] as Unit)}`;
  }
  return undefined;
}
