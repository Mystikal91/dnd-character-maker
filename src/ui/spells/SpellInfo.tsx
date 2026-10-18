import { signal } from "@preact/signals";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { character, content } from "../../app/store";
import { ui } from "../../i18n/ui";

/** The spell whose full details are open in the dialog, if any. */
export const spellDetail = signal<string | undefined>(undefined);

const TIP_WIDTH_REM = 22;
const TIP_MAX_CHARS = 420;

/** What the rules say about one spell: where it sits, how it is cast, and what it does. */
function SpellInfoBody({ id, short = false }: { id: string; short?: boolean }) {
  const c = content.value;
  if (!c) return null;
  const data = c.index.get(id)?.data ?? {};
  const school = c.name(`${character.value.ruleset}:school/${data.school}`);
  const level = data.level as number;
  const components = (data.components as string[] | undefined)?.join(", ");
  const material = c.text(id, "material");
  const rows: [string, string | undefined][] = [
    [ui("spells.castingTime"), c.text(id, "castingTime")],
    [ui("spells.range"), c.text(id, "range")],
    [ui("spells.components"), components && material ? `${components} (${material})` : components],
    [ui("spells.duration"), c.text(id, "duration")],
  ];
  const tags = [
    data.concentration ? ui("spells.concentration") : undefined,
    data.ritual ? ui("spells.ritual") : undefined,
  ].filter(Boolean);

  const desc = c.text(id, "desc") ?? "";
  const shown =
    short && desc.length > TIP_MAX_CHARS ? `${desc.slice(0, TIP_MAX_CHARS).trimEnd()}…` : desc;

  return (
    <>
      <h4 class="spell-info-title">{c.name(id)}</h4>
      <p class="muted">
        {level === 0
          ? ui("spells.cantripSchool", { school })
          : ui("spells.levelSchool", { level, school })}
        {tags.length > 0 && ` · ${tags.join(" · ")}`}
      </p>
      <dl class="spell-info-meta">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      {shown.split("\n\n").map((p) => (
        <p key={p}>{p}</p>
      ))}
      {!short && c.text(id, "higherLevel") && (
        <p>
          <strong>{ui("spells.higherLevel")}.</strong> {c.text(id, "higherLevel")}
        </p>
      )}
    </>
  );
}

/**
 * A small "i" next to a spell name. With a mouse, hovering shows a summary; click, tap or
 * Enter opens the full text in a dialog, which is how it works on touch screens.
 */
export function SpellInfoButton({ id }: { id: string }) {
  const [tip, setTip] = useState<{ left: number; bottom: number; top: number } | undefined>();
  const tipEl = useRef<HTMLDivElement>(null);
  const name = content.value?.name(id) ?? id;

  // The tip lives in the top layer (popover), so no card or clipped container can cut it off.
  // Once it is shown we know its real height and can choose below or above the button.
  useLayoutEffect(() => {
    const el = tipEl.current;
    if (!tip || !el) return;
    if (!el.matches(":popover-open")) el.showPopover();
    const height = el.offsetHeight;
    const below = tip.bottom + 8;
    const top = below + height > innerHeight ? Math.max(8, tip.top - 8 - height) : below;
    el.style.top = `${top}px`;
  }, [tip]);

  const showTip = (button: HTMLElement) => {
    const rect = button.getBoundingClientRect();
    const width = Math.min(TIP_WIDTH_REM * 16, innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, innerWidth - width - 8));
    setTip({ left, bottom: rect.bottom, top: rect.top });
  };

  return (
    <>
      <button
        type="button"
        class="info-btn"
        aria-label={`${ui("spells.info")}: ${name}`}
        onPointerEnter={(e) => e.pointerType === "mouse" && showTip(e.currentTarget)}
        onPointerLeave={() => setTip(undefined)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setTip(undefined);
          spellDetail.value = id;
        }}
      >
        i
      </button>
      {tip && (
        <div
          ref={tipEl}
          popover="manual"
          class="info-tip"
          role="tooltip"
          style={{
            left: `${tip.left}px`,
            top: `${tip.bottom + 8}px`,
            width: `min(${TIP_WIDTH_REM}rem, calc(100vw - 16px))`,
          }}
        >
          <SpellInfoBody id={id} short />
        </div>
      )}
    </>
  );
}

/** The dialog with a spell's full text. Mount it once, near the root. */
export function SpellDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = spellDetail.value;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (id && !el.open) el.showModal();
    if (!id && el.open) el.close();
  }, [id]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking the backdrop is a mouse shortcut; Escape and the Close button are the keyboard ways out
    <dialog
      ref={dialog}
      class="spell-dialog"
      onClose={() => {
        spellDetail.value = undefined;
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) spellDetail.value = undefined;
      }}
    >
      {id && (
        <div class="spell-dialog-body">
          <button
            type="button"
            class="secondary close"
            onClick={() => {
              spellDetail.value = undefined;
            }}
          >
            {ui("spells.closeInfo")}
          </button>
          <SpellInfoBody id={id} />
        </div>
      )}
    </dialog>
  );
}
