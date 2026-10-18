import { useEffect } from "preact/hooks";
import { view } from "../app/printSettings";
import { content, initStorage, loadError, storageReady } from "../app/store";
import { loadContent } from "../content/browser";
import { ui } from "../i18n/ui";
import { CharacterBar } from "./CharacterBar";
import { CharacterForm } from "./CharacterForm";
import { Sheet } from "./Sheet";
import { PrintView } from "./print/PrintView";

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
      <h1>{ui("app.title")}</h1>
      {loadError.value ? (
        <p role="alert">{ui("app.loadError")}</p>
      ) : !content.value || !storageReady.value ? (
        <p>{ui("app.loading")}</p>
      ) : view.value === "print" ? (
        <PrintView />
      ) : (
        <>
          <CharacterBar />
          <div class="layout">
            <CharacterForm />
            <Sheet />
          </div>
        </>
      )}
    </main>
  );
}
