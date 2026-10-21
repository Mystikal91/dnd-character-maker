import { character, content, updateCharacter } from "../../app/store";
import { type SuggestionField, appendLine, backgroundSuggestions } from "../../content/suggestions";
import type { Story } from "../../engine/character";
import { type UiKey, ui } from "../../i18n/ui";
import { Select, entriesOfKind } from "./fields";

type TextField = Exclude<keyof Story, "alignment" | "deity">;

const LOOKS: TextField[] = ["age", "height", "weight", "eyes", "skin", "hair"];
const SUGGESTED: SuggestionField[] = ["personalityTraits", "ideals", "bonds", "flaws"];

function setStory(field: TextField, value: string) {
  updateCharacter((d) => {
    d.story[field] = value;
  });
}

function TextArea({
  field,
  rows = 3,
  suggestions = [],
  hint,
}: {
  field: TextField;
  rows?: number;
  suggestions?: string[];
  hint?: string;
}) {
  const story = character.value.story;
  return (
    <div class="field">
      <label for={`story-${field}`}>
        <span>{ui(`story.${field}` as UiKey)}</span>
      </label>
      {hint && <small class="muted">{hint}</small>}
      <textarea
        id={`story-${field}`}
        rows={rows}
        value={story[field]}
        onInput={(e) => setStory(field, e.currentTarget.value)}
      />
      {suggestions.length > 0 && (
        <select
          aria-label={`${ui(`story.${field}` as UiKey)}: ${ui("story.suggestions")}`}
          value=""
          onChange={(e) => {
            const picked = suggestions[Number(e.currentTarget.value)];
            if (picked) setStory(field, appendLine(story[field], picked));
          }}
        >
          <option value="">{ui("story.suggestions")}</option>
          {suggestions.map((text, i) => (
            <option key={text} value={i}>
              {text}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/** Alignment, personality, appearance and notes: free text, with suggestions from the background. */
export function StoryStep() {
  const c = content.value;
  const ch = character.value;
  const background = ch.choices.background;
  const deities = entriesOfKind("deity");
  const choose = (c?.index.get(background ?? "")?.data.choose ?? {}) as Record<string, number>;

  return (
    <>
      <p class="muted">{ui("story.intro")}</p>
      <Select
        label={ui("story.alignment")}
        value={ch.story.alignment}
        options={entriesOfKind("alignment")}
        onChange={(id) =>
          updateCharacter((d) => {
            d.story.alignment = id;
          })
        }
      />

      {deities.length > 0 && (
        <Select
          label={ui("story.deity")}
          value={ch.story.deity}
          options={deities}
          onChange={(id) =>
            updateCharacter((d) => {
              d.story.deity = id;
            })
          }
        />
      )}

      {SUGGESTED.map((field) => (
        <TextArea
          key={field}
          field={field}
          suggestions={c ? backgroundSuggestions(c.text, background, field) : []}
          {...(choose[field] ? { hint: ui("story.pickHint", { n: choose[field] }) } : {})}
        />
      ))}

      <fieldset>
        <legend>{ui("story.looks")}</legend>
        <div class="looks">
          {LOOKS.map((field) => (
            <label class="field" key={field}>
              <span>{ui(`print.field.${field}` as UiKey)}</span>
              <input
                type="text"
                value={ch.story[field]}
                onInput={(e) => setStory(field, e.currentTarget.value)}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <TextArea field="appearance" />
      <TextArea field="backstory" rows={5} />
      <TextArea field="allies" rows={2} />
      <TextArea field="enemies" rows={2} />
      <TextArea field="notes" rows={4} />
    </>
  );
}
