import { useEffect } from "preact/hooks";
import { language, localeChain } from "../app/language";
import { isPage, showView, view } from "../app/navigation";
import { character, content, initStorage, loadError, storageReady } from "../app/store";
import { loadUserPacks, userPacks, userPacksReady } from "../app/userPacks";
import { loadContent } from "../content/browser";
import { ui } from "../i18n/ui";
import { CharacterBar } from "./CharacterBar";
import { Credits } from "./Credits";
import "../app/translate";
import { STAGE } from "../app/version";
import { AboutPage } from "./AboutPage";
import { AppMenu } from "./AppMenu";
import { AutoTranslatePage } from "./AutoTranslatePage";
import { HomebrewPage } from "./HomebrewPage";
import { PacksPage } from "./PacksPage";
import { QuickEditDialog } from "./QuickEdit";
import { ShareDialog } from "./ShareDialog";
import { Sheet } from "./Sheet";
import { Tabs } from "./Tabs";
import { UpdateNotice } from "./UpdateNotice";
import { BuildTab } from "./build/BuildTab";
import { LevelUp } from "./build/LevelUp";
import { PlayTab } from "./play/PlayTab";
import { PrintView } from "./print/PrintView";
import { SpellDialog } from "./spells/SpellInfo";

function Screen() {
  switch (view.value) {
    case "credits":
      return <Credits />;
    case "packs":
      return <PacksPage />;
    case "homebrew":
      return <HomebrewPage />;
    case "translate":
      return <AutoTranslatePage />;
    case "about":
      return <AboutPage />;
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

  // The tab names the character, so several open tabs can be told apart.
  const heading = character.value.name.trim();
  const appTitle = ui("app.title");
  useEffect(() => {
    document.title = heading ? `${heading} · ${appTitle}` : appTitle;
  }, [heading, appTitle]);

  return (
    <main class="shell">
      <button
        type="button"
        class="skip-link no-print"
        onClick={() => document.getElementById("content")?.focus()}
      >
        {ui("app.skip")}
      </button>
      <header class="app-header no-print">
        <div class="app-title">
          <h1>
            <button type="button" class="title-link" onClick={() => showView("about")}>
              {ui("app.title")}
            </button>{" "}
            <span class="beta-badge">{STAGE}</span>
          </h1>
        </div>
        <AppMenu />
      </header>
      {loadError.value ? (
        <p role="alert">{ui("app.loadError")}</p>
      ) : !content.value || !storageReady.value ? (
        <p>{ui("app.loading")}</p>
      ) : (
        <div id="content" tabIndex={-1} class="content-anchor">
          {!isPage(view.value) && (
            <>
              <CharacterBar />
              <Tabs />
            </>
          )}
          <Screen />
        </div>
      )}
      <UpdateNotice />
      <SpellDialog />
      <QuickEditDialog />
      <ShareDialog />
      <LevelUp />
      <footer class="site-footer no-print">
        <p>{ui("footer.unofficial")}</p>
        <p>
          <button type="button" class="link" onClick={() => showView("about")}>
            {ui("footer.about")}
          </button>
          {" · "}
          <button type="button" class="link" onClick={() => showView("packs")}>
            {ui("footer.packs")}
          </button>
          {" · "}
          <button type="button" class="link" onClick={() => showView("translate")}>
            {ui("footer.translate")}
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
