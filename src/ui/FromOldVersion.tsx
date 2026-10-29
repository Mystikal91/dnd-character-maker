import { signal } from "@preact/signals";
import { useRef } from "preact/hooks";
import { driveConfigured, driveState, loadFromDrive } from "../app/drive";
import { LEGACY_SITE } from "../app/legacy";
import { character, characters } from "../app/store";
import { transferDialog, transferInbox } from "../app/transferState";
import { ui } from "../i18n/ui";
import { DriveMessage } from "./TransferDialog";

const KEY = "from-old-version-hidden";

function wasHidden(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

const hidden = signal(wasHidden());

function hide() {
  hidden.value = true;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Not remembered: it shows again next time, which is harmless.
  }
}

/** For someone who used the app at its old address: bring the characters from there. */
export function FromOldVersion() {
  const picker = useRef<HTMLInputElement>(null);
  const c = character.value;
  const blank = !c.name && c.classes.length === 0 && !c.choices.species && !c.choices.background;
  if (LEGACY_SITE || hidden.value || !blank || characters.value.length > 1) return null;
  return (
    <section class="card welcome">
      <h2>{ui("fromOld.title")}</h2>
      <p>{ui("fromOld.body")}</p>
      <input
        ref={picker}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (!file) return;
          transferInbox.value = await file.text();
          transferDialog.value = "import";
        }}
      />
      <div class="btn-row">
        {driveConfigured && (
          <button
            type="button"
            class="primary"
            disabled={driveState.value === "working"}
            onClick={async () => {
              const text = await loadFromDrive();
              if (text) {
                transferInbox.value = text;
                transferDialog.value = "import";
              }
            }}
          >
            {ui("transfer.drive.load")}
          </button>
        )}
        <button type="button" onClick={() => picker.current?.click()}>
          {ui("transfer.import")}
        </button>
        <button type="button" class="link" onClick={hide}>
          {ui("fromOld.hide")}
        </button>
      </div>
      <DriveMessage />
    </section>
  );
}
