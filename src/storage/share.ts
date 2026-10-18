import type { Character } from "../engine/character";
import { CharacterParseError, parseCharacter } from "../engine/characterSchema";

/**
 * A character travels in a link as `#c=<version>.<data>`: the character document, compressed
 * and written in base64url. It lives in the fragment, which browsers never send to a server.
 */
const PREFIX = "#c=";
const VERSION = "1";

/** What fits in a QR code at the lowest error correction: 2953 bytes in byte mode. */
export const QR_MAX_BYTES = 2900;

async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const writer = stream.writable.getWriter();
  // A failure reaches the caller through the readable side; do not leave a stray rejection.
  writer
    .write(new Uint8Array(bytes))
    .then(() => writer.close())
    .catch(() => undefined);
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** The link fragment for a character, e.g. `#c=1.eJy...`. */
export async function encodeShare(character: Character): Promise<string> {
  // The id is dropped: an imported character always gets a new one.
  const { id: _id, ...document } = character;
  const bytes = new TextEncoder().encode(JSON.stringify(document));
  const packed = await transform(bytes, new CompressionStream("deflate-raw"));
  return `${PREFIX}${VERSION}.${toBase64Url(packed)}`;
}

/** True when `hash` (a `location.hash`) carries a shared character. */
export const isShareHash = (hash: string) => hash.startsWith(PREFIX);

/** Reads a fragment made by `encodeShare`. Throws `CharacterParseError` when it is not valid. */
export async function decodeShare(hash: string): Promise<Character> {
  if (!isShareHash(hash)) throw new CharacterParseError("Not a shared character link");
  const [version, data] = hash.slice(PREFIX.length).split(".");
  if (version !== VERSION || !data) throw new CharacterParseError("Unknown share link version");
  let text: string;
  try {
    const bytes = await transform(fromBase64Url(data), new DecompressionStream("deflate-raw"));
    text = new TextDecoder().decode(bytes);
  } catch {
    throw new CharacterParseError("The share link is damaged");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new CharacterParseError("The share link is damaged");
  }
  return parseCharacter({ ...(raw as object), id: crypto.randomUUID() });
}

/** The full link for a character on this page. */
export async function shareUrl(character: Character, base: string): Promise<string> {
  return `${base.split("#")[0]}${await encodeShare(character)}`;
}
