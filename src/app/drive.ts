import { signal } from "@preact/signals";
import { DRIVE_SCOPE, DriveError, loadTransferFile, saveTransferFile } from "../storage/drive";
import { GOOGLE_CLIENT_ID } from "./driveConfig";

/** Whether this build knows a Google client id: without one the Drive buttons are not shown. */
export const driveConfigured = GOOGLE_CLIENT_ID.trim() !== "";

/** What the Drive buttons are doing, for the message under them. */
export const driveState = signal<"idle" | "working" | "saved" | "none" | "failed">("idle");
export const driveProblem = signal<string | undefined>(undefined);

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
}

interface TokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type?: string }) => void;
          }): TokenClient;
        };
      };
    };
  }
}

let loading: Promise<void> | undefined;

/** Loads Google's sign-in script, only when Drive is about to be used. */
export function loadSignIn(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = undefined;
      reject(new Error("The Google sign-in script could not be loaded"));
    };
    document.head.append(script);
  });
  return loading;
}

let token: { value: string; until: number } | undefined;

/** An access token for the app's own files in Drive; asks the person only when there is none. */
async function accessToken(): Promise<string> {
  if (token && token.until > Date.now() + 30_000) return token.value;
  await loadSignIn();
  const oauth = window.google?.accounts.oauth2;
  if (!oauth) throw new Error("Google sign-in is not available");
  return new Promise<string>((resolve, reject) => {
    const client = oauth.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? "No access"));
          return;
        }
        token = {
          value: response.access_token,
          until: Date.now() + Number(response.expires_in ?? 3600) * 1000,
        };
        resolve(token.value);
      },
      error_callback: (error) => reject(new Error(error.type ?? "The sign-in was closed")),
    });
    client.requestAccessToken();
  });
}

async function run<T>(work: () => Promise<T>): Promise<T | undefined> {
  driveState.value = "working";
  driveProblem.value = undefined;
  try {
    return await work();
  } catch (error) {
    // A refused token is forgotten, so the next try asks again.
    if (error instanceof DriveError && error.status === 401) token = undefined;
    driveState.value = "failed";
    driveProblem.value = error instanceof Error ? error.message : String(error);
    return undefined;
  }
}

/** Puts the transfer file in the person's Drive. */
export async function saveToDrive(text: string): Promise<boolean> {
  const saved = await run(async () => saveTransferFile(await accessToken(), text));
  if (!saved) return false;
  driveState.value = "saved";
  return true;
}

/** The transfer file from the person's Drive, when there is one. */
export async function loadFromDrive(): Promise<string | undefined> {
  const loaded = await run(async () => loadTransferFile(await accessToken()));
  if (driveState.value === "failed") return undefined;
  if (!loaded) {
    driveState.value = "none";
    return undefined;
  }
  driveState.value = "idle";
  return loaded.text;
}
