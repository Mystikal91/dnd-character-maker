import { signal } from "@preact/signals";
import { showView } from "../app/navigation";
import { character, characters, openExample } from "../app/store";
import { startTour } from "../app/tour";
import { ui } from "../i18n/ui";
import { Logo } from "./Logo";

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

/** The first visit: the mark, what the app is, and two ways in, above the first blank character. */
export function Welcome() {
  const c = character.value;
  const blank = !c.name && c.classes.length === 0 && !c.choices.species && !c.choices.background;
  if (dismissed.value || !blank || characters.value.length > 1) return null;
  return (
    <section class="card welcome welcome-hero">
      <div class="hero-sky" aria-hidden="true" />
      <Logo class="hero-logo" />
      <h2 class="hero-title">{ui("app.title")}</h2>
      <p class="hero-tagline">{ui("welcome.tagline")}</p>
      <p class="muted hero-note">{ui("welcome.local")}</p>
      <div class="btn-row hero-actions">
        <button type="button" class="primary" onClick={dismiss}>
          {ui("welcome.start")}
        </button>
        <button
          type="button"
          onClick={() => {
            dismiss();
            void openExample();
          }}
          title={ui("welcome.exampleHint")}
        >
          {ui("welcome.tryExample")}
        </button>
        <button
          type="button"
          onClick={() => {
            dismiss();
            startTour();
          }}
        >
          {ui("tour.start")}
        </button>
        <button
          type="button"
          class="link"
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
