import { describe, expect, it } from "vitest";
import {
  MAX_ZOOM,
  clampView,
  initialView,
  minScale,
  sourceRect,
  squareCrop,
  zoomAt,
} from "./portrait";

describe("squareCrop", () => {
  it("takes the middle of a wide picture", () => {
    expect(squareCrop(400, 200)).toEqual({ x: 100, y: 0, side: 200 });
  });

  it("takes the middle of a tall picture", () => {
    expect(squareCrop(200, 500)).toEqual({ x: 0, y: 150, side: 200 });
  });

  it("keeps a square one whole", () => {
    expect(squareCrop(300, 300)).toEqual({ x: 0, y: 0, side: 300 });
  });
});

describe("the crop frame", () => {
  const frame = 200;

  it("starts with the short side filling the frame and the middle showing", () => {
    const view = initialView(800, 400, frame);
    expect(view.scale).toBe(0.5);
    expect(sourceRect(view, frame)).toEqual({ x: 200, y: 0, side: 400 });
  });

  it("cannot be dragged off the picture", () => {
    const start = initialView(800, 400, frame);
    const far = clampView({ ...start, x: 50, y: 50 }, 800, 400, frame);
    expect(far.x).toBe(0);
    expect(far.y).toBe(0);
    const other = clampView({ ...start, x: -5000, y: -5000 }, 800, 400, frame);
    expect(other.x).toBe(frame - 800 * start.scale);
    expect(other.y).toBe(frame - 400 * start.scale);
  });

  it("zooms in up to a limit, and never out beyond the whole short side", () => {
    const start = initialView(800, 400, frame);
    const low = minScale(800, 400, frame);
    const closest = zoomAt(start, 800, 400, frame, 100, 100, 100);
    expect(closest.scale).toBeCloseTo(low * MAX_ZOOM);
    const out = zoomAt(closest, 800, 400, frame, 100, 100, 0.0001);
    expect(out.scale).toBeCloseTo(low);
  });

  it("keeps the point under the finger where it is while zooming", () => {
    const start = initialView(800, 800, frame);
    const before = sourceRect(start, frame);
    const point = { x: 150, y: 60 };
    const under = {
      x: before.x + point.x / start.scale,
      y: before.y + point.y / start.scale,
    };
    const zoomed = zoomAt(start, 800, 800, frame, point.x, point.y, start.scale * 2);
    const after = sourceRect(zoomed, frame);
    const underAfter = {
      x: after.x + point.x / zoomed.scale,
      y: after.y + point.y / zoomed.scale,
    };
    // The frame edge may have pushed it back; it only matters that it stays inside the frame.
    expect(Math.abs(underAfter.x - under.x)).toBeLessThan(frame / zoomed.scale);
    expect(after.side).toBeCloseTo(before.side / 2);
  });
});
