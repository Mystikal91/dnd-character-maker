import { signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import type { SearchKind } from "../../app/search";
import { content } from "../../app/store";
import { itemData } from "../../data/items";
import { type UiKey, ui } from "../../i18n/ui";
import { ItemTag, itemFacts } from "../ItemTag";
import { Paragraphs } from "../sheet/parts";
import { SpellInfoBody } from "../spells/SpellInfo";
import { MonsterBlock } from "./MonsterBlock";

/** The entry whose rules are open in the dialog, if any. */
export const ruleDetail = signal<string | undefined>(undefined);

/** The properties of a weapon, each with what it means. */
function Properties({ id }: { id: string }) {
  const c = content.value;
  const entry = c?.index.get(id);
  if (!c || !entry) return null;
  let properties: string[] = [];
  try {
    properties = itemData(entry).weapon?.properties ?? [];
  } catch {
    // An item the engine cannot read has no properties to explain.
  }
  const known = properties.filter((p) => c.text(p, "desc"));
  if (known.length === 0) return null;
  return (
    <dl class="rule-properties">
      {known.map((p) => (
        <div key={p}>
          <dt>{c.name(p)}</dt>
          <dd>{c.text(p, "desc")}</dd>
        </div>
      ))}
    </dl>
  );
}

/** What the rules say about one entry: a spell the way it is cast, anything else by its text. */
export function EntryDetail({ id }: { id: string }) {
  const c = content.value;
  const entry = c?.index.get(id);
  if (!c || !entry) return null;
  if (entry.kind === "spell") return <SpellInfoBody id={id} />;
  if (entry.kind === "monster") return <MonsterBlock id={id} />;
  const facts = entry.kind === "item" ? itemFacts(id) : undefined;
  return (
    <div class="rule-detail">
      <h3>{c.name(id)}</h3>
      <p class="muted">
        {ui(`search.kind.${entry.kind as SearchKind}` as UiKey)}
        {entry.kind === "item" && <ItemTag id={id} />}
      </p>
      {facts && <p class="inv-facts">{facts}</p>}
      <Paragraphs text={c.text(id, "desc")} />
      {entry.kind === "item" && <Properties id={id} />}
    </div>
  );
}

/** A small "i" that opens the rules of an entry in a dialog, wherever a name could use it. */
export function RuleInfoButton({ id }: { id: string }) {
  const name = content.value?.name(id) ?? id;
  return (
    <button
      type="button"
      class="info-btn"
      aria-label={`${ui("spells.info")}: ${name}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        ruleDetail.value = id;
      }}
    >
      i
    </button>
  );
}

/** The dialog with the rules of an entry. Mount it once, near the root. */
export function RuleDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = ruleDetail.value;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (id && !el.open) el.showModal();
    if (!id && el.open) el.close();
  }, [id]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking the backdrop is a mouse shortcut; Escape and the Close button are the keyboard ways out
    <dialog
      ref={dialog}
      class="spell-dialog"
      onClose={() => {
        ruleDetail.value = undefined;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) ruleDetail.value = undefined;
      }}
    >
      {id && (
        <div class="spell-dialog-body">
          <button
            type="button"
            class="secondary close"
            onClick={() => {
              ruleDetail.value = undefined;
            }}
          >
            {ui("spells.closeInfo")}
          </button>
          <EntryDetail id={id} />
        </div>
      )}
    </dialog>
  );
}
