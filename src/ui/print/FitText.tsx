import { useLayoutEffect, useRef } from "preact/hooks";
import { printSettings } from "../../app/printSettings";
import { ui } from "../../i18n/ui";

const TIERS = [1, 2, 3, 4];

/** Words of `text` that fit in `chars` characters, cut at a word boundary. */
function shorten(text: string, chars: number): string {
  if (chars >= text.length) return text;
  const cut = text.slice(0, chars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > chars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Card text that always fits its box: it tries bigger type first, then smaller, and only if
 * even the smallest type overflows does it shorten the text and point to the rules.
 * It measures the real layout, so it adapts to the paper size and the loaded fonts.
 */
export function FitText({ text }: { text: string }) {
  const box = useRef<HTMLDivElement>(null);
  const paper = printSettings.value.paper;

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new paper size changes the card size, so the text must be measured again
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;

    const fill = (tier: number, chars: number) => {
      const shown = chars >= text.length ? text : shorten(text, chars);
      el.className = `p-card-text t${tier}`;
      el.replaceChildren(
        ...shown.split("\n\n").map((paragraph) => {
          const p = document.createElement("p");
          p.textContent = paragraph;
          return p;
        }),
      );
      if (chars < text.length) {
        const more = document.createElement("p");
        more.className = "p-card-more";
        more.textContent = ui("print.cardMore");
        el.append(more);
      }
    };
    const fits = () => el.scrollHeight <= el.clientHeight + 1;

    const run = () => {
      for (const tier of TIERS) {
        fill(tier, text.length);
        if (fits()) return;
      }
      // Even the smallest type overflows: find the longest start of the text that fits.
      let low = 0;
      let high = text.length;
      while (high - low > 12) {
        const mid = Math.floor((low + high) / 2);
        fill(4, mid);
        if (fits()) low = mid;
        else high = mid;
      }
      fill(4, low);
    };

    run();
    // Fonts load after the first paint and change the metrics: measure again once ready.
    void document.fonts?.ready.then(run);
    // The frame can change size without this component re-rendering (zoom, layout changes).
    let lastHeight = el.clientHeight;
    const observer = new ResizeObserver(() => {
      if (el.clientHeight === lastHeight) return;
      lastHeight = el.clientHeight;
      run();
      lastHeight = el.clientHeight;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, paper]);

  return <div class="p-card-text t1" ref={box} />;
}
