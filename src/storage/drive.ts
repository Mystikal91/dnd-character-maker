/**
 * The one file that this app keeps in a person's Google Drive: the transfer file. With the
 * `drive.file` permission the app can only see files it made itself, so nothing else in the Drive
 * is readable. The calls take the access token and, for tests, the function that fetches.
 */

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const DRIVE_FILE_NAME = "dnd-character-maker.dndtransfer.json";

const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

type Fetcher = typeof fetch;

export interface DriveFile {
  id: string;
  modifiedTime: string;
}

export class DriveError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call(token: string, url: string, init: RequestInit, fetcher: Fetcher) {
  const response = await fetcher(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (!response.ok)
    throw new DriveError(response.status, `${response.status} ${response.statusText}`);
  return response;
}

/** The transfer file the app made before, the most recent one if there are several. */
export async function findTransferFile(
  token: string,
  fetcher: Fetcher = fetch,
): Promise<DriveFile | undefined> {
  const query = new URLSearchParams({
    q: `name='${DRIVE_FILE_NAME}' and trashed=false`,
    spaces: "drive",
    orderBy: "modifiedTime desc",
    fields: "files(id,modifiedTime)",
  });
  const response = await call(token, `${API}?${query}`, {}, fetcher);
  const found = ((await response.json()) as { files?: DriveFile[] }).files ?? [];
  return found[0];
}

/** Writes the text over the transfer file, or makes the file the first time. */
export async function saveTransferFile(
  token: string,
  text: string,
  fetcher: Fetcher = fetch,
): Promise<DriveFile> {
  const existing = await findTransferFile(token, fetcher);
  const fields = "id,modifiedTime";
  if (existing) {
    const response = await call(
      token,
      `${UPLOAD}/${existing.id}?uploadType=media&fields=${fields}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: text },
      fetcher,
    );
    return (await response.json()) as DriveFile;
  }
  const boundary = `dnd${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({ name: DRIVE_FILE_NAME, mimeType: "application/json" });
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${boundary}`,
    "Content-Type: application/json",
    "",
    text,
    `--${boundary}--`,
  ].join("\r\n");
  const response = await call(
    token,
    `${UPLOAD}?uploadType=multipart&fields=${fields}`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
    fetcher,
  );
  return (await response.json()) as DriveFile;
}

/** The text of the transfer file, or undefined when there is none yet. */
export async function loadTransferFile(
  token: string,
  fetcher: Fetcher = fetch,
): Promise<{ text: string; modifiedTime: string } | undefined> {
  const file = await findTransferFile(token, fetcher);
  if (!file) return undefined;
  const response = await call(token, `${API}/${file.id}?alt=media`, {}, fetcher);
  return { text: await response.text(), modifiedTime: file.modifiedTime };
}
