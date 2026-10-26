import { migrateCharacter } from "../import/aurora/migrate";
import { loadCharacter, saveCharacter } from "../storage/characters";
import { character, characters, refreshList } from "./store";

/**
 * Puts the ids of a pack that was imported again into the characters that use it: the ones saved
 * and the one that is open. Returns how many characters changed.
 */
export async function migrateSavedCharacters(map: ReadonlyMap<string, string>): Promise<number> {
  if (map.size === 0) return 0;
  let changed = 0;
  for (const summary of characters.value) {
    const saved = await loadCharacter(summary.id);
    const moved = saved && migrateCharacter(saved, map);
    if (moved) {
      await saveCharacter(moved);
      changed += 1;
    }
  }
  // The open one may have edits that are not saved yet: it is migrated as it is.
  const open = migrateCharacter(character.peek(), map);
  if (open) character.value = open;
  if (changed > 0) await refreshList();
  return changed;
}
