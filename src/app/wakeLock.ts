import { signal } from "@preact/signals";

interface WakeLockSentinelLike {
  release(): Promise<void>;
}

const KEY = "keepAwake";

/** Whether this browser can keep the screen on. */
export const canKeepAwake = typeof navigator !== "undefined" && "wakeLock" in navigator;

function remembered(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** The person wants the screen to stay on while they play. */
export const keepAwake = signal(canKeepAwake && remembered());

let lock: WakeLockSentinelLike | undefined;

async function acquire() {
  try {
    const api = (
      navigator as unknown as {
        wakeLock: { request(type: "screen"): Promise<WakeLockSentinelLike> };
      }
    ).wakeLock;
    lock = await api.request("screen");
  } catch {
    lock = undefined; // refused (low battery, hidden page): it is tried again when the page is shown
  }
}

async function release() {
  const held = lock;
  lock = undefined;
  await held?.release().catch(() => undefined);
}

/** Switches the screen lock on or off, and remembers the choice. */
export async function setKeepAwake(on: boolean) {
  keepAwake.value = on;
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // Not remembered: it still works for this visit.
  }
  if (on) await acquire();
  else await release();
}

/** Asks for the lock again when the page comes back to the screen, since it is let go when hidden. */
export function startKeepingAwake() {
  if (!canKeepAwake) return;
  if (keepAwake.value) void acquire();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && keepAwake.value && !lock) void acquire();
  });
}
