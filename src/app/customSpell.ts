import { signal } from "@preact/signals";
import { type Draft, newHomebrewPack, saveDraft } from "../homebrew/model";
import { ui } from "../i18n/ui";
import type { UserPackRecord } from "../storage/packs";
import { content, updateCharacter } from "./store";
import { addUserPack, userPacks } from "./userPacks";

/** The id of the homebrew pack that holds the spells written from a character. */
export const PERSONAL_SPELLS_PACK = "hbmyspells";

/** The class a custom spell is written for and the list it goes to (`class|list`), while the window is open. */
export const customSpellFor = signal<string | undefined>(undefined);

/** The pack of the spells written from characters: found, or made the first time. */
function personalPack(): UserPackRecord {
  const found = userPacks.value.find((p) => p.id === PERSONAL_SPELLS_PACK);
  if (found) return found;
  const record = newHomebrewPack(ui("spells.myPack"));
  return {
    ...record,
    id: PERSONAL_SPELLS_PACK,
    pack: { ...record.pack, manifest: { ...record.pack.manifest, id: PERSONAL_SPELLS_PACK } },
  };
}

const slugsOf = (kind: string) =>
  [...(content.value?.index.values() ?? [])]
    .filter((e) => e.kind === kind)
    .map((e) => e.id.split("/")[1] ?? "")
    .filter(Boolean);

/**
 * Saves a spell the person wrote for a class and puts it in the character's list for that class:
 * the cantrips for a cantrip, the other list the class picks from for the others.
 */
export async function addCustomSpell(
  draft: Draft,
  classId: string,
  /** The list of the class for a spell of a level: the one the class picks its spells from. */
  list: "known" | "prepared",
): Promise<string> {
  const saved = saveDraft(
    personalPack(),
    { ...draft, values: { ...draft.values, classes: classId } },
    { languages: slugsOf("language"), skills: slugsOf("skill") },
  );
  await addUserPack(saved.record);
  const level = Number.parseInt(draft.values.level ?? "0", 10) || 0;
  updateCharacter((d) => {
    const lists = d.spells[classId] ?? { cantrips: [], known: [], prepared: [] };
    d.spells[classId] = lists;
    const target = level === 0 ? lists.cantrips : lists[list];
    if (!target.includes(saved.id)) target.push(saved.id);
  });
  return saved.id;
}
