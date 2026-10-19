import { signal } from "@preact/signals";
import { type Draft, newHomebrewPack, removeEntry, saveDraft } from "../homebrew/model";
import type { UserPackRecord } from "../storage/packs";
import { showView } from "./navigation";
import { content } from "./store";
import { addUserPack, userPacks } from "./userPacks";

/** The homebrew pack open in the editor. */
export const editingPackId = signal<string | undefined>(undefined);

export const editingPack = (): UserPackRecord | undefined =>
  userPacks.value.find((p) => p.id === editingPackId.value && p.origin === "homebrew");

/** Starts a homebrew pack and opens it in the editor. */
export async function createHomebrewPack(name: string): Promise<void> {
  const record = newHomebrewPack(name);
  await addUserPack(record);
  openHomebrewPack(record.id);
}

export function openHomebrewPack(id: string): void {
  editingPackId.value = id;
  showView("homebrew");
}

/** Every language slug the app knows, for a background's language choice. */
function languageSlugs(): string[] {
  return [...(content.value?.index.values() ?? [])]
    .filter((e) => e.kind === "language")
    .map((e) => e.id.split("/")[1] ?? "")
    .filter(Boolean);
}

/** Saves a form in the open pack: a new entry, or a replacement for `editing`. */
export async function saveHomebrewEntry(draft: Draft, editing?: string): Promise<void> {
  const record = editingPack();
  if (!record) return;
  const saved = saveDraft(record, draft, { languages: languageSlugs() }, editing);
  await addUserPack(saved.record);
}

export async function deleteHomebrewEntry(id: string): Promise<void> {
  const record = editingPack();
  if (record) await addUserPack(removeEntry(record, id));
}

export async function renameHomebrewPack(name: string): Promise<void> {
  const record = editingPack();
  if (record && name.trim() && name.trim() !== record.name)
    await addUserPack({ ...record, name: name.trim() });
}
