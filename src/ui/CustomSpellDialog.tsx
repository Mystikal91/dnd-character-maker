import { useEffect, useRef, useState } from "preact/hooks";
import { addCustomSpell, customSpellFor } from "../app/customSpell";
import { type Draft, type DraftTrait, blankDraft, draftReady } from "../homebrew/model";
import { ui } from "../i18n/ui";
import { SpellFields } from "./HomebrewPage";

const close = () => {
  customSpellFor.value = undefined;
};

function Form({ classId, list }: { classId: string; list: "known" | "prepared" }) {
  const [draft, setDraft] = useState<Draft>(() => blankDraft("spell"));
  const [saving, setSaving] = useState(false);
  const api = {
    draft,
    set: (key: string, value: string) =>
      setDraft((d) => ({ ...d, values: { ...d.values, [key]: value } })),
    setTraits: (traits: DraftTrait[]) => setDraft((d) => ({ ...d, traits })),
    hide: ["classes"],
  };
  const ready = draftReady(draft);
  return (
    <>
      <p class="muted">{ui("spells.createHint")}</p>
      <SpellFields api={api} />
      <div class="quick-edit-actions">
        <button
          type="button"
          class="primary"
          disabled={!ready || saving}
          onClick={async () => {
            setSaving(true);
            await addCustomSpell(draft, classId, list);
            close();
          }}
        >
          {ui("hb.save")}
        </button>
        <button type="button" onClick={close}>
          {ui("hb.cancel")}
        </button>
      </div>
    </>
  );
}

/** The window to write a spell for a class of the character, which is added to its list. */
export function CustomSpellDialog() {
  const target = customSpellFor.value;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (target && !node.open) node.showModal();
    if (!target && node.open) node.close();
  }, [target]);
  if (!target) return null;
  const [classId = "", list = "known"] = target.split("|");
  return (
    <dialog ref={dialog} class="quick-edit custom-spell" onClose={close}>
      <h3>{ui("spells.create")}</h3>
      <Form classId={classId} list={list === "prepared" ? "prepared" : "known"} />
    </dialog>
  );
}
