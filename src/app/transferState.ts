import { signal } from "@preact/signals";

/**
 * The step of the import/export window that is showing, or undefined when it is closed. "start"
 * asks which of the two; the export steps ask what to export and then how; the import steps ask
 * where from (a file or the Drive, and which file there) and then what to bring in.
 */
export type TransferStep =
  | "start"
  | "exportWhat"
  | "exportCharacter"
  | "export"
  | "importFrom"
  | "importDrive"
  | "import";

export const transferDialog = signal<TransferStep | undefined>(undefined);

/** The text of a transfer file the person opened, waiting to be read in the window. */
export const transferInbox = signal<string | undefined>(undefined);
