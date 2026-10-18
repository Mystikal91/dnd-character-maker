import { useEffect } from "preact/hooks";
import { showView, view } from "../app/navigation";
import { content, initStorage, loadError, storageReady } from "../app/store";
import { loadContent } from "../content/browser";
import { ui } from "../i18n/ui";
import { CharacterBar } from "./CharacterBar";
import { CharacterForm } from "./CharacterForm";
import { Credits } from "./Credits";
import { Sheet } from "./Sheet";
import { ThemeControls } from "./ThemeControls";
import { PrintView } from "./print/PrintView";

function Screen() {
  if (view.value === "credits") return <Credits />;
  if (view.value === "print") return <PrintView />;
  return (
    <>
      <CharacterBar />
      <div class="layout">
        <CharacterForm />
        <Sheet />
      </div>
    </>
  );
}

export function App() {
  useEffect(() => {
    void initStorage();
    loadContent(["en"]).then(
      (loaded) => {
        content.value = loaded;
      },
      (error: unknown) => {
        loadError.value = String(error);
        console.error(error);
      },
    );
  }, []);

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
        <Screen />
      )}
      <footer class="site-footer no-print">
        <p>{ui("footer.unofficial")}</p>
        <p>
          <button type="button" class="link" onClick={() => showView("credits")}>
            {ui("footer.credits")}
          </button>
        </p>
      </footer>
    </main>
  );
}
