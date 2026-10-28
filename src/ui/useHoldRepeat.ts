import type { JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";

/** A press held this long starts repeating. */
export const HOLD_DELAY_MS = 400;
/** Then one step per interval until the finger lifts. */
export const HOLD_REPEAT_MS = 100;

export interface HoldHandlers {
  onPointerDown: (e: JSX.TargetedPointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onClick: () => void;
}

/**
 * Press and hold on a stepper button (hit points, quantities, coins): a tap steps once, a held
 * touch steps again every {@link HOLD_REPEAT_MS} after {@link HOLD_DELAY_MS}, and the click that
 * ends a repeating hold adds no extra step. A mouse never repeats, so a desktop works as before.
 * `step` is called with what the button does and must read the current values when it runs.
 */
export function useHoldRepeat(): (step: () => void) => HoldHandlers {
  const delay = useRef<ReturnType<typeof setTimeout>>();
  const repeat = useRef<ReturnType<typeof setInterval>>();
  const repeated = useRef(false);

  const stop = () => {
    clearTimeout(delay.current);
    clearInterval(repeat.current);
    delay.current = undefined;
    repeat.current = undefined;
  };
  useEffect(
    () => () => {
      clearTimeout(delay.current);
      clearInterval(repeat.current);
    },
    [],
  );

  return (step) => ({
    onPointerDown: (e) => {
      stop();
      repeated.current = false;
      if (e.pointerType === "mouse") return;
      delay.current = setTimeout(() => {
        delay.current = undefined;
        repeat.current = setInterval(() => {
          repeated.current = true;
          step();
        }, HOLD_REPEAT_MS);
      }, HOLD_DELAY_MS);
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onClick: () => {
      if (repeated.current) {
        repeated.current = false;
        return;
      }
      step();
    },
  });
}
