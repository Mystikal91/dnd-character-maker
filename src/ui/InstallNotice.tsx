import { installApp, invitation, inviteLater, inviteNever } from "../app/install";
import { applyUpdate } from "../app/updates";
import { ui } from "../i18n/ui";

/**
 * The invitation to install the app, at the bottom: a button that opens the browser's own window,
 * or, on an iPhone or iPad, the steps to follow in Safari. "Later" puts it off for a week and "No"
 * stops it. It waits while the strip about a new version is on screen.
 */
export function InstallNotice() {
  const kind = invitation.value;
  if (!kind || applyUpdate.value) return null;
  return (
    <output class="install-notice no-print">
      <span>{ui(kind === "ios" ? "install.ios" : "install.invite")}</span>
      <div class="install-row">
        {kind === "prompt" && (
          <button type="button" class="install-go" onClick={() => void installApp()}>
            {ui("install.action")}
          </button>
        )}
        <button type="button" class="install-quiet" onClick={inviteLater}>
          {ui("install.later")}
        </button>
        <button type="button" class="install-quiet" onClick={inviteNever}>
          {ui("install.never")}
        </button>
      </div>
    </output>
  );
}
