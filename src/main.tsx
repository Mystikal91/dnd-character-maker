import "@fontsource/cinzel/latin-600.css";
import "@fontsource/cinzel/latin-700.css";
import "@fontsource/cinzel/latin-ext-600.css";
import "@fontsource/cinzel/latin-ext-700.css";
import "@fontsource/eb-garamond/latin-400-italic.css";
import "@fontsource/eb-garamond/latin-400.css";
import "@fontsource/eb-garamond/latin-600.css";
import "@fontsource/eb-garamond/latin-ext-400-italic.css";
import "@fontsource/eb-garamond/latin-ext-400.css";
import "@fontsource/eb-garamond/latin-ext-600.css";
import { render } from "preact";
import { sendSharedLinkOn } from "./app/legacy";
import { matchThemeColor } from "./app/theme";
import { applyUpdate } from "./app/updates";
import { App } from "./ui/App";
import "./ui/build/build.css";
import "./ui/play/play.css";
import "./ui/print/print.css";
import "./ui/theme/controls.css";
import "./ui/theme/fonts.css";
import "./ui/theme/tokens.css";
import "./ui/theme/fantasy.css";
import "./ui/sheet/sheet.css";
import "./ui/styles.css";
import "./ui/chrome.css";

// On the old address a link to a shared character moves on to Heroquill before anything starts.
const leaving = sendSharedLinkOn();

// The app updates when the person agrees: a notice offers it when a new version is ready.
if (!leaving && "serviceWorker" in navigator && import.meta.env.PROD) {
  void import("virtual:pwa-register").then(({ registerSW }) => {
    const update = registerSW({
      onNeedRefresh() {
        applyUpdate.value = () => void update(true);
      },
      onRegisteredSW(_url, registration) {
        // A long-open app looks for a new version now and then.
        if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
      },
    });
  });
}

const root = document.getElementById("app");
if (root && !leaving) render(<App />, root);
// The style sheets are in by now, so the page colour can be read.
addEventListener("load", matchThemeColor);
