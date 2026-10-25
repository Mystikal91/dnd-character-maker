import { signal } from "@preact/signals";

/** The transfer window: open for sending, open for receiving, or closed. */
export const transferDialog = signal<"export" | "import" | undefined>(undefined);

/** The text of a transfer file the person opened, waiting to be read in the window. */
export const transferInbox = signal<string | undefined>(undefined);
