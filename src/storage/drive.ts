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

/** The ending of the file name of a single character, which tells it from the whole-account file. */
export const CHARACTER_FILE_SUFFIX = ".dndchar.json";

/** The Drive file name for one character: readable, and the same every time for the same one. */
export function characterDriveName(name: string, id: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const tag = id.replace(/[^a-z0-9]/gi, "").slice(0, 8);
  return `dnd-character-maker-${slug || "character"}${tag ? `-${tag}` : ""}${CHARACTER_FILE_SUFFIX}`;
}

/** What a file of the app in the Drive holds: one character, or all of the person's data. */
export function driveFileKind(name: string): "character" | "account" | undefined {
  if (name === DRIVE_FILE_NAME) return "account";
  if (name.endsWith(CHARACTER_FILE_SUFFIX)) return "character";
  return undefined;
}

export interface DriveListing extends DriveFile {
  name: string;
}

/** Every file of the app in the Drive that can be imported, the most recent first. */
export async function listDriveFiles(
  token: string,
  fetcher: Fetcher = fetch,
): Promise<DriveListing[]> {
  const query = new URLSearchParams({
    q: "trashed=false",
    spaces: "drive",
    orderBy: "modifiedTime desc",
    pageSize: "100",
    fields: "files(id,name,modifiedTime)",
  });
  const response = await call(token, `${API}?${query}`, {}, fetcher);
  const found = ((await response.json()) as { files?: DriveListing[] }).files ?? [];
  return found.filter((f) => driveFileKind(f.name) !== undefined);
}

/** The text of one file listed by `listDriveFiles`. */
export async function readDriveFile(
  token: string,
  id: string,
  fetcher: Fetcher = fetch,
): Promise<string> {
  const response = await call(token, `${API}/${id}?alt=media`, {}, fetcher);
  return response.text();
}

/** The file of that name the app made before, the most recent one if there are several. */
async function findByName(
  token: string,
  name: string,
  fetcher: Fetcher,
): Promise<DriveFile | undefined> {
  const query = new URLSearchParams({
    q: `name='${name}' and trashed=false`,
    spaces: "drive",
    orderBy: "modifiedTime desc",
    fields: "files(id,modifiedTime)",
  });
  const response = await call(token, `${API}?${query}`, {}, fetcher);
  const found = ((await response.json()) as { files?: DriveFile[] }).files ?? [];
  return found[0];
}

/** The transfer file the app made before, the most recent one if there are several. */
export const findTransferFile = (token: string, fetcher: Fetcher = fetch) =>
  findByName(token, DRIVE_FILE_NAME, fetcher);

/** Writes the text over the transfer file, or makes the file the first time. */
export const saveTransferFile = (token: string, text: string, fetcher: Fetcher = fetch) =>
  saveDriveFile(token, DRIVE_FILE_NAME, text, fetcher);

/** Writes the text over the file of that name (made by the app), or makes it the first time. */
export async function saveDriveFile(
  token: string,
  name: string,
  text: string,
  fetcher: Fetcher = fetch,
): Promise<DriveFile> {
  // The name is put in a query: only the characters the app's own names use are allowed.
  if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error("Unsupported file name");
  const existing = await findByName(token, name, fetcher);
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
  const metadata = JSON.stringify({ name, mimeType: "application/json" });
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
