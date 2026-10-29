import { type Character, createCharacter } from "../engine/character";
import { type PackIndex, deriveSheet } from "../engine/derive";

/** The id of the example character, so that the same one is found again and not made anew. */
export const EXAMPLE_ID = "00000000-0000-4000-8000-00000a71a000";

const spell = (id: string) => `srd51:spell/${id}`;
const item = (id: string) => `srd51:item/${id}`;

/** What Aria would like in her spellbook and ready for the day, before the rules fill any gaps. */
const WANTED = {
  cantrips: ["fire-bolt", "mage-hand", "light", "prestidigitation"],
  known: [
    "magic-missile",
    "shield",
    "mage-armor",
    "detect-magic",
    "sleep",
    "burning-hands",
    "find-familiar",
    "identify",
    "misty-step",
    "scorching-ray",
    "mirror-image",
    "invisibility",
    "fireball",
    "counterspell",
  ],
  prepared: [
    "magic-missile",
    "shield",
    "mage-armor",
    "detect-magic",
    "misty-step",
    "scorching-ray",
    "mirror-image",
    "fireball",
    "counterspell",
  ],
};

/** The lines of Aria's story, in the language of the person. */
export interface ExampleStory {
  personalityTraits: string;
  ideals: string;
  bonds: string;
  flaws: string;
  appearance: string;
}

/**
 * A character to try the app with: Aria Nightbloom, a high elf evocation wizard of level 5, with
 * her spells picked and a spell slot already spent. Anything the rules still ask for is filled
 * with the first valid option, so the sheet has no open choices.
 */
export function buildExample(index: PackIndex, story: ExampleStory): Character {
  const c = createCharacter("srd51");
  c.id = EXAMPLE_ID;
  c.name = "Aria Nightbloom";
  c.choices = {
    species: "srd51:species/elf",
    subspecies: "srd51:subspecies/high-elf",
    background: "srd51:background/acolyte",
  };
  c.classes = [
    {
      classId: "srd51:class/wizard",
      level: 5,
      subclassId: "srd51:subclass/evocation",
    },
  ];
  c.abilityMethod = "standard";
  c.abilityBase = { str: 8, dex: 13, con: 14, int: 15, wis: 12, cha: 10 };
  c.asi = [["int"]];
  c.inventory = [
    { itemId: item("quarterstaff"), quantity: 1, equipped: true },
    { itemId: item("dagger"), quantity: 1, equipped: false },
    { itemId: item("spellbook"), quantity: 1, equipped: false },
    { itemId: item("component-pouch"), quantity: 1, equipped: false },
    { itemId: item("backpack"), quantity: 1, equipped: false },
  ];
  c.coins = { cp: 0, sp: 4, ep: 0, gp: 23, pp: 0 };
  c.story = {
    ...c.story,
    ...story,
    alignment: "srd51:alignment/neutral-good",
    age: "112",
    eyes: "silver",
    hair: "midnight blue",
  };

  const caster = "srd51:class/wizard";
  c.spells[caster] = {
    cantrips: WANTED.cantrips.map(spell),
    known: WANTED.known.map(spell),
    prepared: WANTED.prepared.map(spell),
  };

  // Fill what the rules still ask for with the first valid options, and trim what is too much.
  for (let pass = 0; pass < 6; pass++) {
    const sheet = deriveSheet(c, index);
    let changed = false;
    for (const choice of sheet.choices) {
      if (choice.remaining <= 0) continue;
      const rest = choice.options.filter((o) => !choice.selected.includes(o));
      c.selections[choice.key] = [...choice.selected, ...rest.slice(0, choice.remaining)];
      changed = true;
    }
    const lists = sheet.spellcasters.find((s) => s.classId === caster)?.lists;
    if (lists) {
      const fill = (pick: typeof lists.known) =>
        pick
          ? [...pick.chosen, ...pick.pool.filter((s) => !pick.chosen.includes(s))].slice(
              0,
              pick.allowed,
            )
          : [];
      const next = {
        cantrips: fill(lists.cantrips),
        known: fill(lists.known),
        prepared: fill(lists.prepared),
      };
      if (JSON.stringify(next) !== JSON.stringify(c.spells[caster])) {
        c.spells[caster] = next;
        changed = true;
      }
    }
    if (!changed) break;
  }

  // A first-level slot is already spent, so the play screen shows something to look at.
  c.play.slotsUsed[0] = 1;
  return c;
}
