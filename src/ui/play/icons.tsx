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

/** The print of a paw: a pad and four toes. */
export const PawIcon = () => (
  <Icon>
    <path d="M8.5 20c-2 0-3.2-1.6-2.6-3.3.6-1.7 3-4.2 6.1-4.2s5.500 2.500 6.100 4.200c.6 1.700-.6 3.300-2.600 3.300-1.600 0-2-.8-3.500-.8s-1.900.8-3.500.8z" />
    <path d="M4.500 11.500c-1 0-1.700-1-1.500-2.200.2-1.200 1-2 1.800-2s1.500 1 1.300 2.200c-.2 1.200-.8 2-1.600 2z" />
    <path d="M9.200 7.500c-1 0-1.800-1.100-1.600-2.500.2-1.300 1-2.200 1.900-2.200s1.700 1.100 1.500 2.500c-.2 1.300-.9 2.200-1.800 2.200z" />
    <path d="M14.800 7.500c1 0 1.800-1.100 1.600-2.500-.2-1.300-1-2.200-1.900-2.200s-1.700 1.100-1.500 2.500c.2 1.300.9 2.200 1.800 2.200z" />
    <path d="M19.500 11.500c1 0 1.700-1 1.500-2.200-.2-1.200-1-2-1.800-2s-1.500 1-1.300 2.200c.2 1.200.8 2 1.600 2z" />
  </Icon>
);

/** A flame. */
export const FlameIcon = () => (
  <Icon>
    <path d="M12 3c1.500 3.500 5 5.500 5 10a5 5 0 0 1-10 0c0-2 1-3.500 2-4.500.2 1.500 1 2.500 2 2.500-.5-2.500-.5-5 1-8z" />
    <path d="M12 21a2.200 2.200 0 0 1-2.200-2.200c0-1.200.8-1.800 1.400-2.600.3.800.8 1.100 1.300 1.200.4.600.7 1.100.7 1.700A2.200 2.200 0 0 1 12 21z" />
  </Icon>
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

/** A head and shoulders. */
export const ProfileIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-4 3-6.500 7-6.500s7 2.500 7 6.500" />
  </Icon>
);

/** An open book. */
export const FeaturesIcon = () => (
  <Icon>
    <path d="M5 5.500C7.500 4.500 10 4.800 12 6.500c2-1.700 4.500-2 7-1v12c-2.500-1-5-.700-7 1-2-1.700-4.500-2-7-1z" />
    <path d="M12 6.500v12" />
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
