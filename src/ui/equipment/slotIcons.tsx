import type { ComponentChildren } from "preact";
import type { BoardSlot } from "../../engine/slots";

const Icon = ({ children }: { children: ComponentChildren }) => (
  <svg
    class="play-icon"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

const ICONS: Record<BoardSlot, () => ComponentChildren> = {
  // A helmet with its visor.
  head: () => (
    <Icon>
      <path d="M5 15a7 7 0 0 1 14 0v4H5z" />
      <path d="M5 15h14M12 8v7" />
    </Icon>
  ),
  // A pendant on its chain.
  neck: () => (
    <Icon>
      <path d="M6 3c0 6 2.500 9 6 9s6-3 6-9" />
      <path d="M12 12l3 4-3 5-3-5z" />
    </Icon>
  ),
  // A cloak with its collar.
  shoulders: () => (
    <Icon>
      <path d="M8 4h8l4 15H4z" />
      <path d="M8 4c1 2 2.500 3 4 3s3-1 4-3" />
    </Icon>
  ),
  // A breastplate.
  body: () => (
    <Icon>
      <path d="M8 4L4 7l2 4 2-1v10h8V10l2 1 2-4-4-3c-.6 1.600-2 2.500-4 2.500S8.600 5.600 8 4z" />
    </Icon>
  ),
  // A bracer: a cuff with its straps.
  arms: () => (
    <Icon>
      <path d="M7 4h10l-1 16H8z" />
      <path d="M7.500 9h9M8 15h8" />
    </Icon>
  ),
  // A glove.
  hands: () => (
    <Icon>
      <path d="M7 20v-7l-2-4 2-1 1.500 2.500V4h2v6V3h2v7V4h2v8l1.500-2 2 1-3 9z" />
    </Icon>
  ),
  // A belt with its buckle.
  waist: () => (
    <Icon>
      <path d="M3 9h18v6H3z" />
      <path d="M10 8h4v8h-4z" />
    </Icon>
  ),
  // A boot.
  feet: () => (
    <Icon>
      <path d="M9 3h5v9l5 3v5H5v-4l4-2z" />
    </Icon>
  ),
  // A ring with its gem.
  ring1: () => (
    <Icon>
      <circle cx="12" cy="15" r="5.500" />
      <path d="M9.500 6.500L12 3.500l2.500 3L12 9.500z" />
    </Icon>
  ),
  ring2: () => (
    <Icon>
      <circle cx="12" cy="15" r="5.500" />
      <path d="M9.500 6.500L12 3.500l2.500 3L12 9.500z" />
    </Icon>
  ),
  // A sword.
  mainHand: () => (
    <Icon>
      <path d="M20 4l-9.500 9.500" />
      <path d="M20 4l-.2 3.800M20 4l-3.800.2" />
      <path d="M8 12l4 4" />
      <path d="M10.500 14.500L5.500 19.500" />
      <circle cx="4.500" cy="19.500" r="1" />
    </Icon>
  ),
  // A shield.
  offHand: () => (
    <Icon>
      <path d="M12 3l7 3v6c0 4.500-3 7.500-7 9-4-1.500-7-4.500-7-9V6z" />
    </Icon>
  ),
};

export const SlotIcon = ({ slot }: { slot: BoardSlot }) => ICONS[slot]();
