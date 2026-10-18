import { useRef } from "preact/hooks";
import { showView } from "../app/navigation";
import {
  character,
  characters,
  deleteCurrentCharacter,
  duplicateCharacter,
  exportCharacter,
  importCharacterFile,
  importFailed,
  newCharacter,
  openCharacter,
  saveStatus,
} from "../app/store";
import { ui } from "../i18n/ui";

const STATUS_KEYS = {
  idle: "bar.idle",
  saving: "bar.saving",
  saved: "bar.saved",
  failed: "bar.notSaved",
} as const;

export function CharacterBar() {
  const fileInput = useRef<HTMLInputElement>(null);
  const current = character.value;
  const label = (name: string) => name || ui("sheet.unnamed");

  // The list is saved data; the open character may be newer, so show its live name.
  const options = characters.value.some((c) => c.id === current.id)
    ? characters.value.map((c) => (c.id === current.id ? { ...c, name: current.name } : c))
    : [{ id: current.id, name: current.name, updatedAt: 0 }, ...characters.value];

  const confirmDelete = () => {
    if (confirm(ui("bar.deleteConfirm", { name: label(current.name) }))) {
      void deleteCurrentCharacter();
    }
  };

  return (
    <div class="card bar">
      <label class="field bar-select">
        <span>{ui("bar.character")}</span>
        <select value={current.id} onChange={(e) => void openCharacter(e.currentTarget.value)}>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {label(c.name)}
            </option>
          ))}
        </select>
      </label>
      <div class="bar-actions">
        <button type="button" onClick={() => void newCharacter()}>
          {ui("bar.new")}
        </button>
        <button type="button" onClick={() => void duplicateCharacter()}>
          {ui("bar.duplicate")}
        </button>
        <button type="button" onClick={() => showView("print")}>
          {ui("bar.print")}
        </button>
        <button type="button" onClick={exportCharacter}>
          {ui("bar.export")}
        </button>
        <button type="button" onClick={() => fileInput.current?.click()}>
          {ui("bar.import")}
        </button>
        <button type="button" class="danger" onClick={confirmDelete}>
          {ui("bar.delete")}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (file) void importCharacterFile(file);
          }}
        />
      </div>
      <output class={`bar-status status-${saveStatus.value}`}>
        {ui(STATUS_KEYS[saveStatus.value])}
      </output>
      {importFailed.value && (
        <p class="note" role="alert">
          {ui("bar.importError")}
        </p>
      )}
    </div>
  );
}
