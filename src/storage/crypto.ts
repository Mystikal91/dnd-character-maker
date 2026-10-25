/**
 * Protects a text with a passphrase, using only what the browser has: a key is made from the
 * passphrase (PBKDF2) and the text is encrypted with AES-GCM, which also notices a wrong
 * passphrase or a file that was changed.
 */

export const SEALED_FORMAT = "dnd-character-maker-sealed";
const ITERATIONS = 210_000;

export interface Sealed {
  format: typeof SEALED_FORMAT;
  version: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  iv: string;
  data: string;
}

export class WrongPassphrase extends Error {}

function toBase64(bytes: Uint8Array): string {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const raw = atob(text);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function keyFrom(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypts a text. The salt and the nonce are new every time. */
export async function seal(text: string, passphrase: string): Promise<Sealed> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(passphrase, salt, ITERATIONS);
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(text),
  );
  return {
    format: SEALED_FORMAT,
    version: 1,
    kdf: "PBKDF2-SHA256",
    iterations: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(data)),
  };
}

/** Decrypts a sealed text; throws `WrongPassphrase` when the passphrase does not fit. */
export async function unseal(sealed: Sealed, passphrase: string): Promise<string> {
  try {
    const key = await keyFrom(passphrase, fromBase64(sealed.salt), sealed.iterations);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(sealed.iv) },
      key,
      fromBase64(sealed.data),
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new WrongPassphrase("The passphrase does not open this file");
  }
}

export function isSealed(raw: unknown): raw is Sealed {
  const doc = raw as Partial<Sealed> | null;
  return (
    typeof doc === "object" &&
    doc !== null &&
    doc.format === SEALED_FORMAT &&
    typeof doc.salt === "string" &&
    typeof doc.iv === "string" &&
    typeof doc.data === "string" &&
    typeof doc.iterations === "number" &&
    doc.iterations > 0 &&
    doc.iterations <= 5_000_000
  );
}
