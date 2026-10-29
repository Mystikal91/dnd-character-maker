/** The side of the stored portrait, in pixels: enough for the sheet at any size it is shown. */
export const PORTRAIT_SIZE = 320;

/** How far a picture can be zoomed in, as a multiple of the zoom that just fills the frame. */
export const MAX_ZOOM = 5;

/**
 * Where a picture sits in the square frame the person crops with. `scale` is how many frame
 * pixels one picture pixel takes; `x` and `y` are where the picture's top left corner is, in frame
 * pixels (never more than 0: the picture always covers the frame).
 */
export interface CropView {
  scale: number;
  x: number;
  y: number;
}

/** The zoom at which the shorter side of the picture just fills a frame of `frame` pixels. */
export const minScale = (width: number, height: number, frame: number) =>
  frame / Math.min(width, height);

const limit = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Puts a view back in bounds: zoomed between the minimum and `MAX_ZOOM` times it, covering the frame. */
export function clampView(view: CropView, width: number, height: number, frame: number): CropView {
  const low = minScale(width, height, frame);
  const scale = limit(view.scale, low, low * MAX_ZOOM);
  return {
    scale,
    x: limit(view.x, frame - width * scale, 0),
    y: limit(view.y, frame - height * scale, 0),
  };
}

/** The first view: the whole short side shown, the middle of the picture in the frame. */
export function initialView(width: number, height: number, frame: number): CropView {
  const scale = minScale(width, height, frame);
  return { scale, x: (frame - width * scale) / 2, y: (frame - height * scale) / 2 };
}

/** Zooms to `scale` keeping the point of the picture under (`px`, `py`) where it is. */
export function zoomAt(
  view: CropView,
  width: number,
  height: number,
  frame: number,
  px: number,
  py: number,
  scale: number,
): CropView {
  const pictureX = (px - view.x) / view.scale;
  const pictureY = (py - view.y) / view.scale;
  const low = minScale(width, height, frame);
  const next = limit(scale, low, low * MAX_ZOOM);
  return clampView(
    { scale: next, x: px - pictureX * next, y: py - pictureY * next },
    width,
    height,
    frame,
  );
}

/** The part of the picture, in its own pixels, that the frame shows. */
export function sourceRect(view: CropView, frame: number) {
  return {
    x: Math.abs(view.x) / view.scale,
    y: Math.abs(view.y) / view.scale,
    side: frame / view.scale,
  };
}

/** The square of an image of `width` by `height` that is cut out: the middle, as large as fits. */
export function squareCrop(width: number, height: number) {
  const side = Math.min(width, height);
  return { x: Math.floor((width - side) / 2), y: Math.floor((height - side) / 2), side };
}

/** Cuts `region` out of a picture and returns it as a small square image, as a `data:` address. */
export function renderPortrait(
  bitmap: ImageBitmap,
  region: { x: number; y: number; side: number },
): string {
  const canvas = document.createElement("canvas");
  canvas.width = PORTRAIT_SIZE;
  canvas.height = PORTRAIT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas");
  context.imageSmoothingQuality = "high";
  context.drawImage(
    bitmap,
    region.x,
    region.y,
    region.side,
    region.side,
    0,
    0,
    PORTRAIT_SIZE,
    PORTRAIT_SIZE,
  );
  // WebP is smaller; a browser that cannot write it falls back to PNG, so ask for JPEG instead.
  const webp = canvas.toDataURL("image/webp", 0.82);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
}
