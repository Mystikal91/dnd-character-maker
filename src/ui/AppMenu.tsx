import { type View, showView } from "../app/navigation";
import { type UiKey, ui } from "../i18n/ui";
import { Popover } from "./Popover";
import { ThemeControls } from "./ThemeControls";

const PAGES: { view: View; label: UiKey }[] = [
  { view: "about", label: "footer.about" },
  { view: "packs", label: "footer.packs" },
  { view: "homebrew", label: "hb.title" },
  { view: "translate", label: "footer.translate" },
  { view: "credits", label: "footer.credits" },
];

/** The settings (language, style, units, mode) and the other pages, behind one button. */
export function AppMenu() {
  return (
    <Popover label={<span aria-hidden="true">☰</span>} title={ui("menu.label")} class="app-menu">
      <h2 class="popover-heading">{ui("menu.settings")}</h2>
      <ThemeControls />
      <h2 class="popover-heading">{ui("menu.pages")}</h2>
      <ul class="menu-list">
        {PAGES.map((page) => (
          <li key={page.view}>
            <button type="button" onClick={() => showView(page.view)}>
              {ui(page.label)}
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
