import { computed, signal } from "@preact/signals";
import { INVITE_DELAY_MS, canInstall, isIos, laterFrom, shouldInvite } from "./install.logic";

/** What Chrome, Edge and Android browsers hand over: it opens their own installation window. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const NEVER_KEY = "installNever";
const LATER_KEY = "installLater";

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore: the invitation may come back next time.
  }
};

function standalone(): boolean {
  if (typeof window === "undefined") return false;
  const asApp =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(display-mode: standalone)").matches
      : false;
  return asApp || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

const deferred = signal<InstallPromptEvent | undefined>(undefined);
/** The app runs installed, or was just installed. */
const installed = signal(standalone());
const never = signal(read(NEVER_KEY) === "1");
const laterUntil = signal(Number(read(LATER_KEY)) || 0);
/** The first seconds of use are over: only then does the invitation show by itself. */
const waited = signal(false);
/** The person asked from the menu: the invitation shows now, whatever was said before. */
const asked = signal(false);

const ios =
  typeof navigator !== "undefined" &&
  isIos(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);

/** The app can be installed from this browser (shows the entry in the menu). */
export const installable = computed(() =>
  canInstall({ installed: installed.value, canPrompt: deferred.value !== undefined, ios }),
);

/** Whether the invitation is on screen, and which kind: the button of the browser or the steps of Safari. */
export const invitation = computed<"prompt" | "ios" | undefined>(() => {
  if (!installable.value) return undefined;
  const invited =
    waited.value &&
    shouldInvite({
      installed: installed.value,
      never: never.value,
      laterUntil: laterUntil.value,
      now: Date.now(),
      canPrompt: deferred.value !== undefined,
      ios,
    });
  if (!invited && !asked.value) return undefined;
  return deferred.value ? "prompt" : "ios";
});

/** The person said "Later": the invitation stays away for a week. */
export function inviteLater(): void {
  laterUntil.value = laterFrom(Date.now());
  write(LATER_KEY, String(laterUntil.value));
  asked.value = false;
}

/** The person said "No": the invitation does not come by itself again (the menu still has the entry). */
export function inviteNever(): void {
  never.value = true;
  write(NEVER_KEY, "1");
  asked.value = false;
}

/** Opens the installation window of the browser; on an iPhone shows the steps instead. */
export async function installApp(): Promise<void> {
  const event = deferred.value;
  if (!event) {
    asked.value = true;
    return;
  }
  await event.prompt();
  const { outcome } = await event.userChoice;
  // The browser lets the prompt be used once.
  deferred.value = undefined;
  if (outcome === "dismissed") inviteLater();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Keep the event to open it from our own button, and hide the bar the browser would show.
    e.preventDefault();
    deferred.value = e as InstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    installed.value = true;
    deferred.value = undefined;
    asked.value = false;
  });
  window.setTimeout(() => {
    waited.value = true;
  }, INVITE_DELAY_MS);
}
