import { signal } from "@preact/signals";

/** Set when a new version of the app is ready: calling it installs the version and reloads. */
export const applyUpdate = signal<(() => void) | undefined>(undefined);
