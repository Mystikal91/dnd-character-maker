import { applyUpdate } from "../app/updates";
import { ui } from "../i18n/ui";

/** A strip at the bottom of the screen when a new version is ready. */
export function UpdateNotice() {
  const apply = applyUpdate.value;
  if (!apply) return null;
  return (
    <output class="update-notice no-print">
      <span>{ui("update.ready")}</span>
      <button type="button" onClick={apply}>
        {ui("update.apply")}
      </button>
    </output>
  );
}
