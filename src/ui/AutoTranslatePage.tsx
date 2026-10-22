import { useState } from "preact/hooks";
import { language } from "../app/language";
import { leavePage } from "../app/navigation";
import { type UiKey, ui } from "../i18n/ui";
import {
  autoError,
  autoSettings,
  cachedCount,
  clearTranslationCache,
  pendingCount,
  saveAutoSettings,
} from "../translate/auto";
import { DEFAULT_RELAY, TranslateError, fetchUsage } from "../translate/deepl";

const REPO_URL = "https://github.com/Mystikal91/dnd-character-maker";

/** Machine translation of the texts that have no translation yet: the person's DeepL key and relay. */
export function AutoTranslatePage() {
  const settings = autoSettings.value;
  const [relay, setRelay] = useState(settings.relay);
  const [key, setKey] = useState(settings.key);
  const [checking, setChecking] = useState(false);
  const [usage, setUsage] = useState<{ used: number; limit: number } | UiKey | undefined>();
  const problem = autoError.value;
  const english = language.value === "en";

  const save = (next: Partial<typeof settings>) =>
    saveAutoSettings({ ...settings, relay, key, ...next });

  const check = async () => {
    setChecking(true);
    save({});
    try {
      setUsage(await fetchUsage({ relay, key }));
    } catch (error) {
      setUsage(
        `translate.err.${error instanceof TranslateError ? error.problem : "failed"}` as UiKey,
      );
    }
    setChecking(false);
  };

  const clear = () => {
    if (confirm(ui("translate.clearConfirm", { n: cachedCount.value })))
      void clearTranslationCache();
  };

  return (
    <article class="card packs">
      <button type="button" class="secondary" onClick={leavePage}>
        {ui("credits.back")}
      </button>
      <h2>{ui("translate.title")}</h2>
      <p>{ui("translate.intro")}</p>
      {english && <p class="note">{ui("translate.english")}</p>}

      <label class="check">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => save({ enabled: e.currentTarget.checked })}
        />
        <span>{ui("translate.enable")}</span>
      </label>

      <label class="check">
        <input
          type="checkbox"
          checked={settings.descriptionsOnly}
          onChange={(e) => save({ descriptionsOnly: e.currentTarget.checked })}
        />
        <span>{ui("translate.descOnly")}</span>
      </label>
      <p class="muted">{ui("translate.descOnlyHint")}</p>

      <h3>{ui("translate.connection")}</h3>
      <label class="field">
        <span>{ui("translate.key")}</span>
        <input
          type="password"
          autocomplete="off"
          spellcheck={false}
          value={key}
          onInput={(e) => setKey(e.currentTarget.value)}
          onBlur={() => save({})}
        />
      </label>
      <p class="muted">{ui("translate.keyHint")}</p>
      <details class="howto">
        <summary>{ui("translate.howTo")}</summary>
        <ol>
          <li>
            {ui("translate.howTo1")}{" "}
            <a href="https://www.deepl.com/pro-api" target="_blank" rel="noopener noreferrer">
              deepl.com/pro-api
            </a>
          </li>
          <li>{ui("translate.howTo2")}</li>
          <li>{ui("translate.howTo3")}</li>
        </ol>
        <p class="muted">{ui("translate.howToNote")}</p>
      </details>
      <label class="field">
        <span>{ui("translate.relay")}</span>
        <input
          type="url"
          value={relay}
          onInput={(e) => setRelay(e.currentTarget.value)}
          onBlur={() => save({})}
        />
      </label>
      <p class="muted">
        {ui("translate.relayHint")}{" "}
        <a
          href={`${REPO_URL}/blob/main/docs/TRANSLATION_PROXY.md`}
          target="_blank"
          rel="noopener noreferrer"
        >
          docs/TRANSLATION_PROXY.md
        </a>
        {relay !== DEFAULT_RELAY && (
          <>
            {" "}
            <button type="button" class="link" onClick={() => setRelay(DEFAULT_RELAY)}>
              {ui("translate.useDefault")}
            </button>
          </>
        )}
      </p>
      <div class="pack-actions">
        <button type="button" disabled={!key.trim() || checking} onClick={() => void check()}>
          {ui("translate.check")}
        </button>
      </div>
      {typeof usage === "object" && (
        <p class="note" aria-live="polite">
          {ui("translate.usage", { used: usage.used, limit: usage.limit })}
        </p>
      )}
      {typeof usage === "string" && (
        <p class="note" role="alert">
          {ui(usage)}
        </p>
      )}
      {problem && (
        <p class="note" role="alert">
          {ui(`translate.err.${problem}` as UiKey)}
        </p>
      )}

      <h3>{ui("translate.saved")}</h3>
      <p>
        {ui("translate.cached", { n: cachedCount.value })}
        {pendingCount.value > 0 && ` ${ui("translate.pending", { n: pendingCount.value })}`}
      </p>
      <div class="pack-actions">
        <button type="button" class="danger" disabled={cachedCount.value === 0} onClick={clear}>
          {ui("translate.clear")}
        </button>
      </div>
    </article>
  );
}
