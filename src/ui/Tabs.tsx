import { type Tab, showView, view } from "../app/navigation";
import { type UiKey, ui } from "../i18n/ui";

const TABS: { id: Tab; label: UiKey }[] = [
  { id: "build", label: "tab.build" },
  { id: "sheet", label: "tab.sheet" },
  { id: "play", label: "tab.play" },
  { id: "print", label: "tab.print" },
];

/** Switch between building the character, reading the sheet and printing it. */
export function Tabs() {
  const current = view.value;
  return (
    <nav class="tabs no-print" aria-label={ui("tab.label")}>
      {TABS.map((tab) => (
        <button
          type="button"
          key={tab.id}
          class={`tab${current === tab.id ? " active" : ""}`}
          aria-current={current === tab.id ? "page" : undefined}
          onClick={() => showView(tab.id)}
        >
          {ui(tab.label)}
        </button>
      ))}
    </nav>
  );
}
