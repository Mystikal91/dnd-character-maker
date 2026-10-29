import type { JSX } from "preact";
import { type Tab, showView, view } from "../app/navigation";
import { type UiKey, ui } from "../i18n/ui";
import { BookIcon, DieIcon, PrinterIcon, QuillIcon, SheetIcon } from "./icons";

const TABS: { id: Tab; label: UiKey; icon: () => JSX.Element }[] = [
  { id: "build", label: "tab.build", icon: QuillIcon },
  { id: "sheet", label: "tab.sheet", icon: SheetIcon },
  { id: "play", label: "tab.play", icon: DieIcon },
  { id: "rules", label: "tab.rules", icon: BookIcon },
  { id: "print", label: "tab.print", icon: PrinterIcon },
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
          <tab.icon />
          <span class="tab-label">{ui(tab.label)}</span>
        </button>
      ))}
    </nav>
  );
}
