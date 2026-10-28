import { useEffect } from "preact/hooks";
import { showView } from "../app/navigation";
import { rulesFocus } from "../app/rulesView";
import { ui } from "../i18n/ui";

/** Opens the rules page with the cursor in its search field. */
function openRules() {
  showView("rules");
  rulesFocus.value += 1;
}

/** A button for the header that goes to the search of the rules; the slash key does the same. */
export function SearchButton() {
  // A slash goes there from anywhere that is not a field to type in.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      openRules();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  return (
    <button
      type="button"
      class="search-button"
      aria-label={ui("search.open")}
      title={ui("search.open")}
      onClick={openRules}
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
