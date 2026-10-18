import { computed, signal } from "@preact/signals";
import type { Content } from "../content/browser";
import { applyAbilityMethod } from "../engine/abilityScores";
import { type Character, createCharacter } from "../engine/character";
import { CharacterParseError } from "../engine/characterSchema";
import { type DerivedSheet, deriveSheet } from "../engine/derive";
import { ui } from "../i18n/ui";
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
import { exportFileName, parseImport, serializeCharacter } from "../storage/transfer";

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
  const removed = character.value.id;
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
  const next = characters.value[0];
  const loaded = next ? await loadCharacter(next.id) : undefined;
  await switchTo(loaded ?? createNewCharacter());
}

/** Downloads the current character as a file the user can keep, send or import elsewhere. */
export function exportCharacter() {
  const current = character.value;
  const url = URL.createObjectURL(
    new Blob([serializeCharacter(current)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(current);
  link.click();
  URL.revokeObjectURL(url);
}

export async function importCharacterFile(file: File) {
  try {
    await switchTo(parseImport(await file.text()));
  } catch (error) {
    if (!(error instanceof CharacterParseError)) console.error("Import failed", error);
    importFailed.value = true;
  }
}
