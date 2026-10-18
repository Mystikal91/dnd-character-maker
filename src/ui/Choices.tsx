import { character, content, sheet, updateCharacter } from "../app/store";
import type { Content } from "../content/browser";
import type { PendingChoice } from "../engine/choices";
import { type UiKey, ui } from "../i18n/ui";
import { SpellInfoButton } from "./spells/SpellInfo";

/** The display name of one option of a choice, whatever it grants. */
function optionLabel(c: Content, ruleset: string, choice: PendingChoice, option: string): string {
  switch (choice.grants) {
    case "proficiency": {
      const [category, target = ""] = option.split(":");
      return category === "skill"
        ? c.name(`${ruleset}:skill/${target}`)
        : c.name(`${ruleset}:proficiency/${target}`);
    }
    case "language":
      return c.name(`${ruleset}:language/${option}`);
    case "abilityBonus":
      return c.name(`${ruleset}:ability/${option}`);
    case "spell":
    case "trait":
      return c.name(option);
  }
}

export function Choices() {
  const c = content.value;
  const s = sheet.value;
  const ch = character.value;
  if (!c || !s) return null;

  const pending = s.choices.reduce((sum, choice) => sum + choice.remaining, 0);

  const toggle = (choice: PendingChoice, option: string, on: boolean) => {
    updateCharacter((d) => {
      const current = d.selections[choice.key] ?? [];
      const next = on ? [...current, option] : current.filter((o) => o !== option);
      if (next.length === 0) delete d.selections[choice.key];
      else d.selections[choice.key] = next;
    });
  };

  // Proficiencies and languages already held (from fixed effects or other choices) cannot be
  // picked again for nothing; they stay visible but disabled.
  const alreadyHeld = (choice: PendingChoice, option: string) => {
    if (choice.selected.includes(option)) return false;
    if (choice.grants === "language") return s.proficiencies.language.includes(option);
    if (choice.grants === "proficiency") {
      const [category, target = ""] = option.split(":");
      return (s.proficiencies[category as keyof typeof s.proficiencies] ?? []).includes(target);
    }
    return false;
  };

  return (
    <fieldset class="choices">
      <legend>{ui("choices.title")}</legend>
      {s.choices.length === 0 ? (
        <p class="muted">{ui("choices.none")}</p>
      ) : (
        <p class={pending > 0 ? "note" : "muted"}>
          {pending > 0 ? ui("choices.pending", { count: pending }) : ui("choices.done")}
        </p>
      )}
      {s.choices.map((choice) => (
        <fieldset class="choice" key={choice.key}>
          <legend>{c.name(choice.source)}</legend>
          <p class="muted">
            {ui(`choice.kind.${choice.grants}` as UiKey)} ·{" "}
            {ui("choice.hint", { n: choice.choose, left: choice.remaining })}
          </p>
          <ul class="options">
            {choice.options.map((option) => {
              const held = alreadyHeld(choice, option);
              const checked = choice.selected.includes(option);
              const full = !checked && choice.remaining === 0;
              return (
                <li key={option}>
                  <label class={held ? "disabled" : ""}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={held || full}
                      onChange={(e) => toggle(choice, option, e.currentTarget.checked)}
                    />
                    {optionLabel(c, ch.ruleset, choice, option)}
                    {held && <span class="muted"> ({ui("choice.alreadyHave")})</span>}
                  </label>
                  {choice.grants === "spell" && <SpellInfoButton id={option} />}
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
    </fieldset>
  );
}
