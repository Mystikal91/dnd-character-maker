import { signal } from "@preact/signals";
import { language } from "./language";
import { editsPackId, nextEditStrings } from "./quickEdit.logic";
import { content } from "./store";
import { addUserPack, removeUserPack, userPacks } from "./userPacks";

/** The entry whose texts the Quick edit dialog is open for, if any. */
export const quickEditId = signal<string | undefined>(undefined);

export const openQuickEdit = (id: string) => {
  quickEditId.value = id;
};
export const closeQuickEdit = () => {
  quickEditId.value = undefined;
};

/** Saves the texts of an entry in the quick edits of the language in use. */
export async function saveQuickEdit(id: string, values: Record<string, string>): Promise<void> {
  const c = content.value;
  if (!c) return;
  const lang = language.value;
  const packId = editsPackId(lang);
  const existing = userPacks.value.find((p) => p.id === packId);
  const strings = nextEditStrings(existing?.strings ?? {}, id, values, (f) => c.base(id, f));
  if (Object.keys(strings).length === 0) {
    if (existing) await removeUserPack(packId);
    return;
  }
  await addUserPack({
    id: packId,
    name: `Quick edits (${lang})`,
    origin: "edits",
    addedAt: existing?.addedAt ?? Date.now(),
    lang,
    strings,
    pack: {
      manifest: {
        id: packId,
        ruleset: "custom",
        version: "1",
        license: "Personal use",
        attribution: "Quick edits made on this device",
      },
      entries: [],
    },
  });
}

/** Puts the original texts of an entry back. */
export async function restoreQuickEdit(id: string): Promise<void> {
  const c = content.value;
  if (!c) return;
  await saveQuickEdit(id, Object.fromEntries(c.fields(id).map((f) => [f, ""])));
}
