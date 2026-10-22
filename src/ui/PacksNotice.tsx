import { showView } from "../app/navigation";
import { dismissPacksNotice, dismissedVersion, showsPacksNotice } from "../app/packsNotice";
import {
  importProgress,
  isStale,
  packError,
  reimportStalePacks,
  userPacks,
  userPacksReady,
} from "../app/userPacks";
import { ui } from "../i18n/ui";

/**
 * A strip at the top when packs imported from Aurora were made by an older importer. It offers
 * to update them (all at once when each remembers its address) or to put it off.
 */
export function PacksNotice() {
  const stale = userPacks.value.filter(isStale);
  if (!userPacksReady.value || !showsPacksNotice(stale.length, dismissedVersion.value)) return null;
  const progress = importProgress.value;
  const canUpdateHere = stale.every((r) => r.source?.url) && !packError.value;

  return (
    <output class="packs-notice no-print" aria-live="polite">
      <span>
        {progress
          ? ui("packs.progress", { done: progress.done, total: progress.total })
          : ui("packsNotice.text", { n: stale.length })}
      </span>
      <span class="packs-notice-actions">
        <button
          type="button"
          class="primary"
          disabled={Boolean(progress)}
          onClick={() => (canUpdateHere ? void reimportStalePacks() : showView("packs"))}
        >
          {canUpdateHere ? ui("packsNotice.update") : ui("packsNotice.open")}
        </button>
        <button
          type="button"
          class="link"
          disabled={Boolean(progress)}
          onClick={dismissPacksNotice}
        >
          {ui("packsNotice.later")}
        </button>
      </span>
    </output>
  );
}
