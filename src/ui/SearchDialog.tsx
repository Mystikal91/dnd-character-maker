import { signal } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";
import { type SearchHit, search } from "../app/search";
import { content } from "../app/store";
import { type UiKey, ui } from "../i18n/ui";
import { Paragraphs } from "./sheet/parts";
import { spellDetail } from "./spells/SpellInfo";

const searchOpen = signal(false);

/** A button for the header that opens the search of the rules. */
export function SearchButton() {
  return (
    <button
      type="button"
      class="search-button"
      aria-label={ui("search.open")}
      title={ui("search.open")}
      onClick={() => {
        searchOpen.value = true;
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M15.500 15.500L21 21" />
      </svg>
    </button>
  );
}

/** What was found, one line each: its name and what kind of thing it is. */
function Results({ hits, onPick }: { hits: SearchHit[]; onPick: (hit: SearchHit) => void }) {
  return (
    <ul class="search-results">
      {hits.map((hit) => (
        <li key={hit.id}>
          <button type="button" onClick={() => onPick(hit)}>
            <span class="search-name">{hit.name}</span>
            <small class="muted">{ui(`search.kind.${hit.kind}` as UiKey)}</small>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The rules text of one result, in the dialog. */
function Detail({ hit, onBack }: { hit: SearchHit; onBack: () => void }) {
  const c = content.value;
  if (!c) return null;
  return (
    <div class="search-detail">
      <button type="button" class="link" onClick={onBack}>
        {"← "}
        {ui("search.back")}
      </button>
      <h3>{hit.name}</h3>
      <p class="muted">{ui(`search.kind.${hit.kind}` as UiKey)}</p>
      <Paragraphs text={c.text(hit.id, "desc")} />
    </div>
  );
}

/** Looks up spells, items, feats, conditions and features by name or by what their text says. */
export function SearchDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const open = searchOpen.value;
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<SearchHit | undefined>();
  const c = content.value;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      field.current?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  // A slash opens the search from anywhere that is not a field to type in.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      searchOpen.value = true;
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const hits = c && open ? search(c, query) : [];

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking the backdrop is a mouse shortcut; Escape and the Close button are the keyboard ways out
    <dialog
      ref={dialog}
      class="spell-dialog search-dialog"
      aria-label={ui("search.title")}
      onClose={() => {
        searchOpen.value = false;
        setPicked(undefined);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) searchOpen.value = false;
      }}
    >
      {open && (
        <div class="spell-dialog-body">
          <button
            type="button"
            class="secondary close"
            onClick={() => {
              searchOpen.value = false;
            }}
          >
            {ui("spells.closeInfo")}
          </button>
          {picked ? (
            <Detail hit={picked} onBack={() => setPicked(undefined)} />
          ) : (
            <>
              <h3>{ui("search.title")}</h3>
              <input
                ref={field}
                type="search"
                class="search-field"
                value={query}
                placeholder={ui("search.placeholder")}
                aria-label={ui("search.title")}
                autoComplete="off"
                onInput={(e) => setQuery(e.currentTarget.value)}
              />
              {query.trim().length < 2 ? (
                <p class="muted">{ui("search.hint")}</p>
              ) : hits.length === 0 ? (
                <p class="muted">{ui("search.none")}</p>
              ) : (
                <Results
                  hits={hits}
                  onPick={(hit) => {
                    if (hit.kind === "spell") spellDetail.value = hit.id;
                    else setPicked(hit);
                  }}
                />
              )}
            </>
          )}
        </div>
      )}
    </dialog>
  );
}
