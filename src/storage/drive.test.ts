import { describe, expect, it } from "vitest";
import {
  DRIVE_FILE_NAME,
  DriveError,
  findTransferFile,
  loadTransferFile,
  saveTransferFile,
} from "./drive";

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

/** A Drive that holds at most one file, answering as the real one does. */
function fakeDrive(initial?: { id: string; text: string }) {
  let file = initial && { ...initial, modifiedTime: "2026-10-25T10:00:00Z" };
  const calls: Call[] = [];
  const fetcher = (async (url: string, init: RequestInit = {}) => {
    const headers = init.headers as Record<string, string>;
    calls.push({
      url,
      method: init.method ?? "GET",
      headers,
      body: init.body as string | undefined,
    });
    const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
    if (headers.Authorization !== "Bearer good") return new Response("no", { status: 401 });
    if (url.includes("uploadType=multipart")) {
      const text = (init.body as string).split("\r\n").slice(-3)[0] ?? "";
      file = { id: "new1", text, modifiedTime: "2026-10-25T11:00:00Z" };
      return json({ id: file.id, modifiedTime: file.modifiedTime });
    }
    if (url.includes("uploadType=media") && file) {
      file = { ...file, text: init.body as string, modifiedTime: "2026-10-25T12:00:00Z" };
      return json({ id: file.id, modifiedTime: file.modifiedTime });
    }
    if (url.includes("alt=media") && file) return new Response(file.text, { status: 200 });
    if (url.includes("?q=") || url.includes("?")) return json({ files: file ? [file] : [] });
    return new Response("?", { status: 404 });
  }) as typeof fetch;
  return { fetcher, calls };
}

describe("the transfer file in Google Drive", () => {
  it("is made the first time and written over after that", async () => {
    const drive = fakeDrive();
    expect(await findTransferFile("good", drive.fetcher)).toBeUndefined();
    const made = await saveTransferFile("good", '{"a":1}', drive.fetcher);
    expect(made.id).toBe("new1");
    const create = drive.calls.find((c) => c.url.includes("multipart"));
    expect(create?.method).toBe("POST");
    expect(create?.body).toContain(DRIVE_FILE_NAME);
    // The second time the same file is updated, not a second one made.
    const again = await saveTransferFile("good", '{"a":2}', drive.fetcher);
    expect(again.id).toBe("new1");
    const update = drive.calls.filter((c) => c.method === "PATCH");
    expect(update).toHaveLength(1);
    expect(update[0]?.url).toContain("/new1?uploadType=media");
    expect(update[0]?.body).toBe('{"a":2}');
    expect((await loadTransferFile("good", drive.fetcher))?.text).toBe('{"a":2}');
  });

  it("looks only for the file of the app, with the token it was given", async () => {
    const drive = fakeDrive({ id: "f1", text: "x" });
    await findTransferFile("good", drive.fetcher);
    const url = decodeURIComponent(drive.calls[0]?.url ?? "");
    expect(url).toContain(`name='${DRIVE_FILE_NAME}'`);
    expect(drive.calls[0]?.headers.Authorization).toBe("Bearer good");
  });

  it("says there is nothing when no file was saved, and fails clearly when refused", async () => {
    const empty = fakeDrive();
    expect(await loadTransferFile("good", empty.fetcher)).toBeUndefined();
    await expect(loadTransferFile("bad", empty.fetcher)).rejects.toBeInstanceOf(DriveError);
    await expect(loadTransferFile("bad", empty.fetcher)).rejects.toMatchObject({ status: 401 });
  });
});
