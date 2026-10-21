import { signal } from "@preact/signals";
import { showView } from "../app/navigation";
import { character, characters } from "../app/store";
import { ui } from "../i18n/ui";

const KEY = "welcomed";

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

const dismissed = signal(wasDismissed());

function dismiss() {
  dismissed.value = true;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Not remembered: it shows again next time, which is harmless.
  }
}

/** A few lines for the first visit, above the first blank character. */
export function Welcome() {
  const c = character.value;
  const blank = !c.name && c.classes.length === 0 && !c.choices.species && !c.choices.background;
  if (dismissed.value || !blank || characters.value.length > 1) return null;
  return (
    <section class="card welcome">
      <h2>{ui("welcome.title")}</h2>
      <p>{ui("welcome.intro")}</p>
      <p class="muted">{ui("welcome.local")}</p>
      <div class="btn-row">
        <button type="button" class="primary" onClick={dismiss}>
          {ui("welcome.start")}
        </button>
        <button
          type="button"
          onClick={() => {
            dismiss();
            showView("about");
          }}
        >
          {ui("welcome.about")}
        </button>
      </div>
    </section>
  );
}
