import { useEffect, useRef, useState } from "preact/hooks";
import { language } from "../app/language";
import { showView, view } from "../app/navigation";
import { endTour, nextStop, previousStop, tourLength, tourStep } from "../app/tour";
import { type Box, TOUR_STEPS, cardGoesBelow, spotAround } from "../app/tour.logic";
import { guidePath } from "../content/news";
import { type UiKey, ui } from "../i18n/ui";

/** The first element of a selector list that is on the screen (the summary has two places). */
function findTarget(selector: string | undefined): HTMLElement | undefined {
  if (!selector) return undefined;
  for (const element of document.querySelectorAll<HTMLElement>(selector)) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return element;
  }
  return undefined;
}

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * The guided tour: one stop at a time, with the part of the app it talks about lit and the rest
 * dimmed, and a card that says what it is for. It moves through the tabs by itself.
 */
export function Tour() {
  const index = tourStep.value;
  const step = index === undefined ? undefined : TOUR_STEPS[index];
  const [spot, setSpot] = useState<Box | undefined>();
  const next = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!step) return;
    if (step.view && view.value !== step.view) {
      showView(step.view);
      window.scrollTo(0, 0);
    }
    if (step.open) {
      // The section may need a moment to be drawn: it is opened when found.
      const wait = setInterval(() => {
        const section = document.querySelector<HTMLDetailsElement>(step.open as string);
        if (!section) return;
        section.open = true;
        clearInterval(wait);
      }, 50);
      setTimeout(() => clearInterval(wait), 2000);
    }
    if (!step.target) {
      setSpot(undefined);
      return;
    }
    let cancelled = false;
    let target: HTMLElement | undefined;
    let frame = 0;
    let tries = 0;

    const measure = () => {
      if (!target) return;
      const rect = target.getBoundingClientRect();
      setSpot(spotAround(rect, { width: window.innerWidth, height: window.innerHeight }));
    };
    // The screen may still be drawing (a tab was just opened) or scrolling to the target.
    const follow = (until: number) => {
      if (cancelled) return;
      measure();
      if (performance.now() < until) frame = requestAnimationFrame(() => follow(until));
    };
    const find = () => {
      if (cancelled) return;
      target = findTarget(step.target);
      if (target) {
        target.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
        follow(performance.now() + 900);
      } else if (++tries < 45) {
        frame = requestAnimationFrame(find);
      } else {
        setSpot(undefined);
      }
    };
    frame = requestAnimationFrame(find);

    addEventListener("resize", measure);
    addEventListener("scroll", measure, true);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      removeEventListener("resize", measure);
      removeEventListener("scroll", measure, true);
    };
  }, [step]);

  useEffect(() => {
    if (index === undefined) return;
    next.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") endTour();
      else if (e.key === "ArrowRight") nextStop();
      else if (e.key === "ArrowLeft") previousStop();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [index]);

  if (index === undefined || !step) return null;
  const last = index === tourLength - 1;
  const title = ui(`tour.${step.id}.title` as UiKey);
  const below = spot ? cardGoesBelow(spot, window.innerHeight) : true;
  const placing = spot ? (below ? "below" : "above") : "middle";

  return (
    <div class="tour no-print">
      <div class={`tour-block${spot ? "" : " dim"}`} />
      {spot && (
        <div
          class="tour-spot"
          aria-hidden="true"
          style={{
            top: `${spot.top}px`,
            left: `${spot.left}px`,
            width: `${spot.width}px`,
            height: `${spot.height}px`,
          }}
        />
      )}
      <dialog
        open
        class={`tour-card tour-${placing}`}
        aria-label={ui("tour.label")}
        style={spot ? { "--tour-left": `${spot.left}px` } : undefined}
      >
        <p class="tour-count">{ui("tour.step", { n: index + 1, total: tourLength })}</p>
        <h2>{title}</h2>
        <p>{ui(`tour.${step.id}.body` as UiKey)}</p>
        {last && (
          <p>
            <a href={guidePath(language.value)} target="_blank" rel="noopener noreferrer">
              {ui("tour.guides")}
            </a>
          </p>
        )}
        <div class="tour-dots" aria-hidden="true">
          {TOUR_STEPS.map((other, i) => (
            <span key={other.id} class={i === index ? "on" : i < index ? "seen" : ""} />
          ))}
        </div>
        <div class="tour-actions">
          {last ? null : (
            <button type="button" class="link" onClick={endTour}>
              {ui("tour.skip")}
            </button>
          )}
          <span class="tour-spacer" />
          <button type="button" disabled={index === 0} onClick={previousStop}>
            {ui("tour.back")}
          </button>
          <button type="button" class="primary" ref={next} onClick={nextStop}>
            {last ? ui("tour.done") : ui("tour.next")}
          </button>
        </div>
      </dialog>
    </div>
  );
}
