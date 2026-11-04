import { useState } from "preact/hooks";
import { isHomebrewId } from "../app/homebrew";
import { ui } from "../i18n/ui";
import type { FormApi } from "./HomebrewPage";
import { entriesOfKind } from "./build/fields";

/**
 * The properties of a weapon or armor as chips to tick, and where the form allows it a small form
 * to write a new one (a title and a text), which is ticked at once. Properties are words: they
 * change no number.
 */
export function PropertyPicker({ api }: { api: FormApi }) {
  const [writing, setWriting] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const options = api.properties?.options ?? entriesOfKind("property");
  const create = api.properties?.create;
  const picked = new Set((api.draft.values.properties ?? "").split(",").filter(Boolean));
  const set = (next: Set<string>) => api.set("properties", [...next].join(","));
  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set(next);
  };
  const add = () => {
    if (!title.trim() || !create) return;
    const id = create(title.trim(), text.trim());
    set(new Set([...picked, id]));
    setTitle("");
    setText("");
    setWriting(false);
  };

  return (
    <fieldset class="hb-many prop-picker">
      <legend>{ui("hb.f.properties")}</legend>
      <p class="muted">{ui("item.propertiesHint")}</p>
      <div class="prop-chips">
        {options.map((o) => (
          <button
            type="button"
            key={o.id}
            class="prop-chip"
            aria-pressed={picked.has(o.id)}
            onClick={() => toggle(o.id)}
          >
            {o.label}
            {isHomebrewId(o.id) && <small>{ui("tag.homebrew")}</small>}
          </button>
        ))}
      </div>
      {create &&
        (writing ? (
          <div class="prop-new">
            <label class="field">
              <span>{ui("item.prop.title")}</span>
              <input type="text" value={title} onInput={(e) => setTitle(e.currentTarget.value)} />
            </label>
            <label class="field">
              <span>{ui("item.prop.desc")}</span>
              <textarea rows={3} value={text} onInput={(e) => setText(e.currentTarget.value)} />
            </label>
            <div class="prop-new-actions">
              <button type="button" class="primary" disabled={!title.trim()} onClick={add}>
                {ui("item.prop.add")}
              </button>
              <button type="button" onClick={() => setWriting(false)}>
                {ui("hb.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" class="prop-write" onClick={() => setWriting(true)}>
            {ui("item.prop.new")}
          </button>
        ))}
    </fieldset>
  );
}
