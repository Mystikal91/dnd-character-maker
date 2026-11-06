/** Days the invitation to install stays away after "Later". */
export const LATER_DAYS = 7;

/** How long the app is open before the invitation first shows, in milliseconds. */
export const INVITE_DELAY_MS = 8000;

export interface InstallFacts {
  /** The app already runs as an installed one (its own window, or opened from the home screen). */
  installed: boolean;
  /** The person said "No": the invitation never comes back on its own. */
  never: boolean;
  /** The invitation waits until this time (milliseconds), after "Later". */
  laterUntil: number;
  now: number;
  /** The browser gave a prompt to open (Chrome, Edge, Android). */
  canPrompt: boolean;
  /** An iPhone or iPad: no prompt exists, only the steps to follow in Safari. */
  ios: boolean;
}

/** The app can be installed from here: with the browser's prompt, or by the steps of Safari. */
export const canInstall = (f: Pick<InstallFacts, "installed" | "canPrompt" | "ios">): boolean =>
  !f.installed && (f.canPrompt || f.ios);

/** The invitation shows by itself: installable, not refused, and not put off for now. */
export const shouldInvite = (f: InstallFacts): boolean =>
  canInstall(f) && !f.never && f.now >= f.laterUntil;

/** When the invitation may come back after "Later". */
export const laterFrom = (now: number): number => now + LATER_DAYS * 24 * 60 * 60 * 1000;

/** An iPhone or an iPad, including the iPad that says it is a Mac (it has a touch screen). */
export function isIos(userAgent: string, platform: string, touchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (platform === "MacIntel" && touchPoints > 1);
}
