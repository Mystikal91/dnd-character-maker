import type { ComponentChildren } from "preact";

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

/** Two crossed swords. */
export const CombatIcon = () => (
  <Icon>
    <path d="M5 4l9 9M19 4l-9 9" />
    <path d="M3.5 14.5l3 3M20.5 14.5l-3 3M6 18l-2 2M18 18l2 2M9.5 11.5l-3 3M14.5 11.5l3 3" />
  </Icon>
);

/** A twenty-sided die. */
export const ChecksIcon = () => (
  <Icon>
    <path d="M12 2.5l8 4.5v10l-8 4.5-8-4.5V7z" />
    <path d="M12 8l4 7H8z" />
  </Icon>
);

/** A four-pointed spark. */
export const MagicIcon = () => (
  <Icon>
    <path d="M12 3c.6 4.2 2.2 6.4 7 9-4.8 2.6-6.4 4.8-7 9-.6-4.2-2.2-6.4-7-9 4.8-2.6 6.4-4.8 7-9z" />
  </Icon>
);

/** A pouch with a drawstring. */
export const ResourcesIcon = () => (
  <Icon>
    <path d="M9 4h6l-1.5 3h-3z" />
    <path d="M10.5 7C6 9 4.5 12.5 5 16c.4 2.6 2.4 4 7 4s6.6-1.4 7-4c.5-3.500-1-7-5.500-9" />
    <path d="M9.500 14h5" />
  </Icon>
);
