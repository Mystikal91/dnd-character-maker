import { language } from "../app/language";
import { applyUpdate, updateNews } from "../app/updates";
import { newsPath } from "../content/news";
import { summaryOf } from "../content/whatsNew.logic";
import { ui } from "../i18n/ui";

/**
 * A strip at the bottom of the screen when a new version is ready, and, when the website could say
 * what the new version brings, what changes (the newest versions, in a few words).
 */
export function UpdateNotice() {
  const apply = applyUpdate.value;
  const news = updateNews.value;
  if (!apply) return null;
  return (
    <output class="update-notice no-print">
      <div class="update-row">
        <span>{ui("update.ready")}</span>
        <button type="button" onClick={apply}>
          {ui("update.apply")}
        </button>
      </div>
      {news.length > 0 && (
        <details class="update-news">
          <summary>{ui("update.whatsNew")}</summary>
          <ul>
            {news.map((entry) => (
              <li key={entry.version}>
                <b>{entry.version}</b> {summaryOf(entry, language.value)}
              </li>
            ))}
          </ul>
          <a href={newsPath(language.value)} target="_blank" rel="noopener noreferrer">
            {ui("update.allNews")}
          </a>
        </details>
      )}
    </output>
  );
}
