import { LEGACY_SITE } from "../app/legacy";
import { transferDialog } from "../app/transferState";
import { ui } from "../i18n/ui";

/** On the old address: a strip at the top that says the app has moved and how to move with it. */
export function LegacyNotice() {
  if (!LEGACY_SITE) return null;
  return (
    <aside class="legacy-notice no-print">
      <span>{ui("legacy.notice")}</span>
      <button
        type="button"
        class="primary"
        onClick={() => {
          transferDialog.value = "start";
        }}
      >
        {ui("legacy.noticeAction")}
      </button>
    </aside>
  );
}
