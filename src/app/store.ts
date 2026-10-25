import { computed, signal } from "@preact/signals";
import type { Content } from "../content/browser";
import { applyAbilityMethod } from "../engine/abilityScores";
import { type Character, createCharacter } from "../engine/character";
import { CharacterParseError } from "../engine/characterSchema";
import { type DerivedSheet, deriveSheet } from "../engine/derive";
import { ui } from "../i18n/ui";
import { openTransfer } from "../storage/bundle";
import {
  type CharacterSummary,
  deleteCharacter,
  getCurrentId,
  listCharacters,
  loadCharacter,
  requestPersistence,
  saveCharacter,
  setCurrentId,
} from "../storage/characters";
import { decodeShare, isShareHash } from "../storage/share";
import { backupFileName, parseBackup, parseImportFile, serializeBackup } from "../storage/transfer";
import { transferDialog, transferInbox } from "./transferState";

export type SaveStatus = "idle" | "saving" | "saved" | "failed";

/** A blank character that starts with the standard array, the easiest way to assign scores. */
function createNewCharacter(): Character {
  const fresh = createCharacter("srd51");
  applyAbilityMethod(fresh, "standard");
  return fresh;
}

export const content = signal<Content | undefined>(undefined);
export const loadError = signal<string | undefined>(undefined);
export const character = signal<Character>(createNewCharacter());
export const characters = signal<CharacterSummary[]>([]);
export const saveStatus = signal<SaveStatus>("idle");
export const importFailed = signal(false);
/** What the last import of a backup did, shown in the character bar. */
export const importNotice = signal<{ added: number; skipped: number; packs?: number } | undefined>(
  undefined,
);

const BACKUP_KEY = "lastBackup";
function readLastBackup(): number | undefined {
  try {
    const saved = Number(localStorage.getItem(BACKUP_KEY));
    return saved > 0 ? saved : undefined;
  } catch {
    return undefined;
  }
}
/** When all the characters were last exported, if they ever were (kept in this browser). */
export const lastBackup = signal<number | undefined>(readLastBackup());
/** The character just deleted, kept for a few seconds so it can be brought back. */
export const deletedCharacter = signal<Character | undefined>(undefined);
let undoTimer: ReturnType<typeof setTimeout> | undefined;
const UNDO_MS = 15000;
/** What happened to a character that arrived in the page link, if one did. */
export const shareNotice = signal<"imported" | "failed" | undefined>(undefined);
/** True once saved characters have been read (or storage turned out to be unavailable). */
export const storageReady = signal(false);

/** The sheet is always derived: it recomputes whenever the character or content changes. */
export const sheet = computed<DerivedSheet | undefined>(() =>
  content.value ? deriveSheet(character.value, content.value.index) : undefined,
);

/**
 * The same character as if nothing were forced by hand. The Free edit panel shows it next to
 * each field, so the player knows what the automatic value would be.
 */
export const calculated = computed<DerivedSheet | undefined>(() =>
  content.value
    ? deriveSheet({ ...character.value, overrides: {} }, content.value.index)
    : undefined,
);

/** True when the player forced this value in Free edit. */
export function isForced(key: string): boolean {
  return typeof character.value.overrides[key] === "number";
}

const SAVE_DELAY_MS = 400;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

async function refreshList() {
  characters.value = await listCharacters();
}

/** Writes the current character now, cancelling any pending delayed save. */
export async function saveNow(): Promise<void> {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  const current = character.value;
  try {
    await saveCharacter(current);
    await setCurrentId(current.id);
    await refreshList();
    if (saveTimer === undefined) saveStatus.value = "saved";
  } catch (error) {
    console.error("Saving failed", error);
    saveStatus.value = "failed";
  }
}

function scheduleSave() {
  saveStatus.value = "saving";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void saveNow(), SAVE_DELAY_MS);
}

/** Edits a copy of the character, publishes it, and saves it shortly after. */
export function updateCharacter(edit: (draft: Character) => void) {
  const draft = structuredClone(character.value);
  edit(draft);
  character.value = draft;
  scheduleSave();
}

/** Makes `next` the open character, saving the previous one first if it has unsaved edits. */
async function switchTo(next: Character) {
  if (saveTimer !== undefined) await saveNow();
  character.value = next;
  importFailed.value = false;
  await saveNow();
}

/** Loads saved characters at startup; creates the first one if there are none. */
export async function initStorage(): Promise<void> {
  try {
    void requestPersistence();
    await refreshList();
    const currentId = await getCurrentId();
    const wanted = currentId ?? characters.value[0]?.id;
    const loaded = wanted ? await loadCharacter(wanted) : undefined;
    if (loaded) {
      character.value = loaded;
      saveStatus.value = "saved";
    } else {
      await saveNow();
    }
    // Flush pending edits when the tab is hidden or closed; the delay timer may not fire then.
    addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && saveTimer !== undefined) void saveNow();
    });
    addEventListener("pagehide", () => {
      if (saveTimer !== undefined) void saveNow();
    });
    addEventListener("hashchange", () => void importFromLink());
    await importFromLink();
  } catch (error) {
    console.error("Storage is not available", error);
    saveStatus.value = "failed";
  } finally {
    storageReady.value = true;
  }
}

/**
 * Opens the character carried by the page link (`#c=...`) as a new character, then removes
 * the fragment so reloading does not import it again.
 */
export async function importFromLink(): Promise<void> {
  if (!isShareHash(location.hash)) return;
  const hash = location.hash;
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  try {
    await switchTo(await decodeShare(hash));
    shareNotice.value = "imported";
  } catch (error) {
    if (!(error instanceof CharacterParseError))
      console.error("Opening a shared link failed", error);
    shareNotice.value = "failed";
  }
}

export const newCharacter = () => switchTo(createNewCharacter());

export async function openCharacter(id: string) {
  if (id === character.value.id) return;
  if (saveTimer !== undefined) await saveNow();
  const loaded = await loadCharacter(id);
  if (!loaded) {
    await refreshList();
    return;
  }
  character.value = loaded;
  importFailed.value = false;
  await setCurrentId(id).catch(() => undefined);
}

export function duplicateCharacter() {
  const original = character.value;
  const copy = {
    ...structuredClone(original),
    id: crypto.randomUUID(),
    name: ui("bar.copyName", { name: original.name || ui("sheet.unnamed") }),
  };
  return switchTo(copy);
}

export async function deleteCurrentCharacter() {
  const snapshot = structuredClone(character.value);
  const removed = snapshot.id;
  clearTimeout(saveTimer);
  saveTimer = undefined;
  try {
    await deleteCharacter(removed);
    await refreshList();
  } catch (error) {
    console.error("Deleting failed", error);
    saveStatus.value = "failed";
    return;
  }
  deletedCharacter.value = snapshot;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => {
    deletedCharacter.value = undefined;
  }, UNDO_MS);
  const next = characters.value[0];
  const loaded = next ? await loadCharacter(next.id) : undefined;
  await switchTo(loaded ?? createNewCharacter());
}

/** Brings back the character that was just deleted. */
export async function undoDelete() {
  const back = deletedCharacter.value;
  if (!back) return;
  clearTimeout(undoTimer);
  deletedCharacter.value = undefined;
  // Deleting the only character opened a blank one: it is not worth keeping next to this one.
  const open = character.value;
  const blank =
    !open.name && open.classes.length === 0 && !open.choices.species && !open.choices.background;
  if (blank) await deleteCharacter(open.id).catch(() => undefined);
  await saveCharacter(back);
  await refreshList();
  await switchTo(back);
}

/** Hands a text to the user as a file download. */
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** Every saved character, as saved. */
export async function allCharacters(): Promise<Character[]> {
  await saveNow();
  const all: Character[] = [];
  for (const summary of characters.value) {
    const loaded = await loadCharacter(summary.id);
    if (loaded) all.push(loaded);
  }
  return all;
}

/** Downloads every saved character in one file, so they can be kept or moved to another device. */
export async function exportAllCharacters() {
  const all = await allCharacters();
  download(backupFileName(), serializeBackup(all), "application/json");
  const now = Date.now();
  lastBackup.value = now;
  try {
    localStorage.setItem(BACKUP_KEY, String(now));
  } catch {
    // Not remembered: the file was still made.
  }
}

/**
 * Puts the characters of a backup back. One that is already here and the same is left alone; one
 * with the same id that differs becomes a copy, so nothing is overwritten.
 */
export async function restoreCharacters(
  incomingList: Character[],
): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;
  let last: Character | undefined;
  for (const incoming of incomingList) {
    const here = characters.value.some((s) => s.id === incoming.id)
      ? await loadCharacter(incoming.id)
      : undefined;
    if (here && JSON.stringify(here) === JSON.stringify(incoming)) {
      skipped += 1;
      continue;
    }
    const kept = here
      ? {
          ...incoming,
          id: crypto.randomUUID(),
          name: ui("bar.copyName", { name: incoming.name || ui("sheet.unnamed") }),
        }
      : incoming;
    await saveCharacter(kept);
    last = kept;
    added += 1;
  }
  await refreshList();
  if (last) await switchTo(last);
  return { added, skipped };
}

async function restoreBackup(backup: { characters: Character[]; unreadable: number }) {
  const done = await restoreCharacters(backup.characters);
  importNotice.value = { added: done.added, skipped: done.skipped + backup.unreadable };
}

export async function importCharacterFile(file: File) {
  importNotice.value = undefined;
  try {
    const text = await file.text();
    // A transfer file (possibly protected) has a window of its own.
    if (openTransfer(text)) {
      transferInbox.value = text;
      transferDialog.value = "import";
      importFailed.value = false;
      return;
    }
    const backup = parseBackup(text);
    if (backup) {
      await restoreBackup(backup);
      importFailed.value = false;
      return;
    }
    const parsed = parseImportFile(text);
    await switchTo(parsed.character);
    // The packs that came with it are put with the ones here (a module loaded now: it uses this one).
    if (parsed.packs.length > 0) {
      const { addCarriedPacks } = await import("./carry");
      importNotice.value = { added: 1, skipped: 0, packs: await addCarriedPacks(parsed.packs) };
    }
  } catch (error) {
    if (!(error instanceof CharacterParseError)) console.error("Import failed", error);
    importFailed.value = true;
  }
}
