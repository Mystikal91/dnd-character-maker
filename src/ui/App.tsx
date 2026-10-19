import { useEffect } from "preact/hooks";
import { language, localeChain } from "../app/language";
import { showView, view } from "../app/navigation";
import { content, initStorage, loadError, storageReady } from "../app/store";
import { loadUserPacks, userPacks, userPacksReady } from "../app/userPacks";
import { loadContent } from "../content/browser";
import { ui } from "../i18n/ui";
import { CharacterBar } from "./CharacterBar";
import { Credits } from "./Credits";
import { PacksPage } from "./PacksPage";
import { ShareDialog } from "./ShareDialog";
import { Sheet } from "./Sheet";
import { Tabs } from "./Tabs";
import { ThemeControls } from "./ThemeControls";
import { BuildTab } from "./build/BuildTab";
import { PlayTab } from "./play/PlayTab";
import { PrintView } from "./print/PrintView";
import { SpellDialog } from "./spells/SpellInfo";

function Screen() {
  switch (view.value) {
    case "credits":
      return <Credits />;
    case "packs":
      return <PacksPage />;
    case "print":
      return <PrintView />;
    case "sheet":
      return <Sheet />;
    case "play":
      return <PlayTab />;
    default:
      return <BuildTab />;
  }
}

export function App() {
  useEffect(() => {
    void initStorage();
    void loadUserPacks();
  }, []);

  // Rules texts follow the language; the old texts stay on screen until the new ones are loaded.
  const lang = language.value;
  const added = userPacks.value;
  const packsReady = userPacksReady.value;
  useEffect(() => {
    if (!packsReady) return;
    let current = true;
    loadContent(localeChain(lang), added).then(
      (loaded) => {
        if (current) content.value = loaded;
      },
      (error: unknown) => {
        loadError.value = String(error);
        console.error(error);
      },
    );
    return () => {
      current = false;
    };
  }, [lang, added, packsReady]);

  return (
    <main class="shell">
      <header class="app-header no-print">
        <div class="app-title">
          <h1>{ui("app.title")}</h1>
        </div>
        <ThemeControls />
      </header>
      {loadError.value ? (
        <p role="alert">{ui("app.loadError")}</p>
      ) : !content.value || !storageReady.value ? (
        <p>{ui("app.loading")}</p>
      ) : (
        <>
          <CharacterBar />
          <Tabs />
          <Screen />
        </>
      )}
      <SpellDialog />
      <ShareDialog />
      <footer class="site-footer no-print">
        <p>{ui("footer.unofficial")}</p>
        <p>
          <button type="button" class="link" onClick={() => showView("packs")}>
            {ui("footer.packs")}
          </button>
          {" · "}
          <button type="button" class="link" onClick={() => showView("credits")}>
            {ui("footer.credits")}
          </button>
        </p>
      </footer>
    </main>
  );
}
