import type { JSX } from "preact";
import { type View, showView } from "../app/navigation";
import { type UiKey, ui } from "../i18n/ui";
import { Popover } from "./Popover";
import { ThemeControls } from "./ThemeControls";
import { BoxIcon, FlaskIcon, GlobeIcon, HeartIcon, InfoIcon } from "./icons";

const PAGES: { view: View; label: UiKey; icon: () => JSX.Element }[] = [
  { view: "about", label: "footer.about", icon: InfoIcon },
  { view: "packs", label: "footer.packs", icon: BoxIcon },
  { view: "homebrew", label: "hb.title", icon: FlaskIcon },
  { view: "translate", label: "footer.translate", icon: GlobeIcon },
  { view: "credits", label: "footer.credits", icon: HeartIcon },
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
              <page.icon />
              <span>{ui(page.label)}</span>
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
