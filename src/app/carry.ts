import { homebrewUsedBy, mergeCarried } from "../storage/carried";
import type { UserPackRecord } from "../storage/packs";
import { exportFileName, serializeCharacter } from "../storage/transfer";
import { character } from "./store";
import { addUserPack, userPacks } from "./userPacks";

/** Downloads the open character with the homebrew packs it uses, so the file opens the same anywhere. */
export function exportCharacterWithPacks(): void {
  const current = character.value;
  const url = URL.createObjectURL(
    new Blob([serializeCharacter(current, homebrewUsedBy(current, userPacks.value))], {
      type: "application/json",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(current);
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Puts the packs that came with a character file among the ones here, keeping what is here.
 * Returns how many packs gained something.
 */
export async function addCarriedPacks(packs: UserPackRecord[]): Promise<number> {
  let changed = 0;
  for (const incoming of packs) {
    const here = userPacks.value.find((p) => p.id === incoming.id);
    // A pack of the same id that is not the person's own homebrew is not touched.
    if (here && here.origin !== "homebrew") continue;
    const merged = mergeCarried(here, incoming);
    if (merged.added > 0) {
      await addUserPack(merged.record);
      changed += 1;
    }
  }
  return changed;
}
