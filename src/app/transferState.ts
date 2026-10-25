import { signal } from "@preact/signals";

/** The transfer window: at its start, preparing a file, opening one, or closed. */
export const transferDialog = signal<"start" | "export" | "import" | undefined>(undefined);

/** The text of a transfer file the person opened, waiting to be read in the window. */
export const transferInbox = signal<string | undefined>(undefined);
