/** The side of the stored portrait, in pixels: enough for the sheet at any size it is shown. */
export const PORTRAIT_SIZE = 320;

/** The square of an image of `width` by `height` that is cut out: the middle, as large as fits. */
export function squareCrop(width: number, height: number) {
  const side = Math.min(width, height);
  return { x: Math.floor((width - side) / 2), y: Math.floor((height - side) / 2), side };
}

/**
 * Turns a picture the person chose into a small square image as a `data:` address, cut from the
 * middle. Throws when the file is not an image the browser can read.
 */
export async function portraitFromFile(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const { x, y, side } = squareCrop(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = PORTRAIT_SIZE;
    canvas.height = PORTRAIT_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No canvas");
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, x, y, side, side, 0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
    // WebP is smaller; a browser that cannot write it falls back to PNG, so ask for JPEG instead.
    const webp = canvas.toDataURL("image/webp", 0.82);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    bitmap.close();
  }
}
