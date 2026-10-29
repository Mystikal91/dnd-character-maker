import { isShareHash } from "../storage/share";

/**
 * True in the build kept on the old address (github.io), which only helps people move to
 * Heroquill: it shows a notice and a guide to move their data, and sends shared links on.
 */
export const LEGACY_SITE = import.meta.env.VITE_LEGACY_SITE === "1";

/** Where the app lives now. */
export const NEW_APP_URL = "https://heroquill.app/app/";

/** A link to a shared character has nothing to move, so it goes straight to the new address. */
export function sendSharedLinkOn(): boolean {
  if (!LEGACY_SITE || !isShareHash(location.hash)) return false;
  location.replace(`${NEW_APP_URL}${location.hash}`);
  return true;
}
