import { useEffect, useRef, useState } from "preact/hooks";
import {
  type CropView,
  MAX_ZOOM,
  clampView,
  initialView,
  minScale,
  renderPortrait,
  sourceRect,
  zoomAt,
} from "../../app/portrait";
import { ui } from "../../i18n/ui";

/** The part of the square frame the medallion shows: a hexagon, a little narrower than the square. */
const HEXAGON = "50,0 93.3,25 93.3,75 50,100 6.7,75 6.7,25";

/** Arrow keys move the picture by this many frame pixels, plus and minus zoom by this factor. */
const KEY_STEP = 12;
const KEY_ZOOM = 1.12;

/**
 * A window to cut the portrait out of the picture the person chose: drag to move it, the slider,
 * the wheel or two fingers to zoom. The hexagon shows what the medallion will show; what is
 * outside it is kept dim. The result is the square the frame shows, as a small image.
 */
export function PortraitEditor({
  bitmap,
  onUse,
  onCancel,
  onOther,
}: {
  bitmap: ImageBitmap;
  onUse: (picture: string) => void;
  onCancel: () => void;
  onOther: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState(0);
  const [view, setView] = useState<CropView | undefined>(undefined);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | undefined>(undefined);
  const { width, height } = bitmap;

  // Open as a dialog and measure the frame once it is on screen.
  useEffect(() => {
    dialog.current?.showModal();
    const size = stage.current?.clientWidth ?? 0;
    setFrame(size);
    setView(initialView(width, height, size));
  }, [width, height]);

  // Draw what the frame shows, sharp on screens with a higher pixel density.
  useEffect(() => {
    const target = canvas.current;
    if (!target || !view || frame === 0) return;
    const ratio = window.devicePixelRatio || 1;
    target.width = Math.round(frame * ratio);
    target.height = Math.round(frame * ratio);
    const context = target.getContext("2d");
    if (!context) return;
    context.imageSmoothingQuality = "high";
    const { x, y, side } = sourceRect(view, frame);
    context.drawImage(bitmap, x, y, side, side, 0, 0, target.width, target.height);
  }, [bitmap, view, frame]);

  if (!view || frame === 0) {
    return (
      <dialog ref={dialog} class="quick-edit portrait-editor" onClose={onCancel}>
        <div class="crop-stage" ref={stage} />
      </dialog>
    );
  }

  const low = minScale(width, height, frame);
  const zoom = (view.scale / low - 1) / (MAX_ZOOM - 1);
  const move = (dx: number, dy: number) =>
    setView((v) => (v ? clampView({ ...v, x: v.x + dx, y: v.y + dy }, width, height, frame) : v));
  const zoomBy = (px: number, py: number, scale: number) =>
    setView((v) => (v ? zoomAt(v, width, height, frame, px, py, scale) : v));
  const local = (e: PointerEvent) => {
    const box = stage.current?.getBoundingClientRect();
    return { x: e.clientX - (box?.left ?? 0), y: e.clientY - (box?.top ?? 0) };
  };

  return (
    <dialog ref={dialog} class="quick-edit portrait-editor" onClose={onCancel}>
      <h3>{ui("portrait.editTitle")}</h3>
      <p class="muted">{ui("portrait.editHint")}</p>
      <div
        class="crop-stage"
        ref={stage}
        role="application"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the picture is moved with the arrow keys, so the stage takes the focus
        tabIndex={0}
        aria-label={ui("portrait.editHint")}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pointers.current.set(e.pointerId, local(e));
          pinch.current = undefined;
        }}
        onPointerMove={(e) => {
          const known = pointers.current.get(e.pointerId);
          if (!known) return;
          const now = local(e);
          pointers.current.set(e.pointerId, now);
          if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            if (!a || !b) return;
            const distance = Math.hypot(a.x - b.x, a.y - b.y);
            if (pinch.current !== undefined && pinch.current > 0)
              zoomBy((a.x + b.x) / 2, (a.y + b.y) / 2, view.scale * (distance / pinch.current));
            pinch.current = distance;
          } else if (pointers.current.size === 1) {
            move(now.x - known.x, now.y - known.y);
          }
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
          pinch.current = undefined;
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          pinch.current = undefined;
        }}
        onWheel={(e) => {
          e.preventDefault();
          const box = e.currentTarget.getBoundingClientRect();
          zoomBy(
            e.clientX - box.left,
            e.clientY - box.top,
            view.scale * Math.exp(-e.deltaY * 0.0015),
          );
        }}
        onKeyDown={(e) => {
          const moves: Record<string, [number, number]> = {
            ArrowLeft: [KEY_STEP, 0],
            ArrowRight: [-KEY_STEP, 0],
            ArrowUp: [0, KEY_STEP],
            ArrowDown: [0, -KEY_STEP],
          };
          const step = moves[e.key];
          if (step) {
            e.preventDefault();
            move(step[0], step[1]);
          } else if (e.key === "+" || e.key === "=") {
            e.preventDefault();
            zoomBy(frame / 2, frame / 2, view.scale * KEY_ZOOM);
          } else if (e.key === "-") {
            e.preventDefault();
            zoomBy(frame / 2, frame / 2, view.scale / KEY_ZOOM);
          }
        }}
      >
        <canvas ref={canvas} class="crop-canvas" style={{ width: frame, height: frame }} />
        <svg class="crop-mask" viewBox="0 0 100 100" aria-hidden="true">
          <path
            d={`M0 0H100V100H0Z M${HEXAGON.split(" ").join(" L")} Z`}
            fill="rgb(0 0 0 / 0.55)"
            fill-rule="evenodd"
          />
          <polygon
            points={HEXAGON}
            fill="none"
            stroke="var(--accent)"
            stroke-width="1.2"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <label class="field crop-zoom">
        <span>{ui("portrait.zoom")}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={zoom}
          onInput={(e) => {
            const t = Number(e.currentTarget.value);
            zoomBy(frame / 2, frame / 2, low * (1 + t * (MAX_ZOOM - 1)));
          }}
        />
      </label>
      <div class="quick-edit-actions">
        <button
          type="button"
          class="primary"
          onClick={() => {
            try {
              onUse(renderPortrait(bitmap, sourceRect(view, frame)));
            } catch {
              onCancel();
            }
          }}
        >
          {ui("portrait.use")}
        </button>
        <button type="button" onClick={onOther}>
          {ui("portrait.other")}
        </button>
        <button type="button" class="link" onClick={onCancel}>
          {ui("portrait.cancel")}
        </button>
      </div>
    </dialog>
  );
}
