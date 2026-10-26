import { signal } from "@preact/signals";

/** The parts the play screen is split into on a phone. */
export const PLAY_GROUPS = ["combat", "checks", "magic", "resources"] as const;
export type PlayGroup = (typeof PLAY_GROUPS)[number];

const KEY = "playGroup";

function remembered(): PlayGroup {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && (PLAY_GROUPS as readonly string[]).includes(saved)) return saved as PlayGroup;
  } catch {
    // Storage may be blocked: the screen opens on its first part.
  }
  return "combat";
}

/** The part shown on a phone; the person comes back to the one they left. */
export const playGroup = signal<PlayGroup>(remembered());

export function showPlayGroup(group: PlayGroup) {
  playGroup.value = group;
  try {
    localStorage.setItem(KEY, group);
  } catch {
    // Not remembered: it still works for this visit.
  }
}

/** Whether the drawer with the dice and the roll history is open (on a phone). */
export const diceOpen = signal(false);
