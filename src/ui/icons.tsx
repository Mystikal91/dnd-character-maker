import type { ComponentChildren } from "preact";

const Icon = ({ children }: { children: ComponentChildren }) => (
  <svg
    class="ui-icon"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

/** A quill: building a character. */
export const QuillIcon = () => (
  <Icon>
    <path d="M20 4C13 4 8.5 8 7.5 14l-3 6 6-3c6-1 10-6 9.500-13z" />
    <path d="M9 16l8-9" />
  </Icon>
);

/** A page with a folded corner: the sheet. */
export const SheetIcon = () => (
  <Icon>
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M15 3v4h4M9 12h7M9 16h7" />
  </Icon>
);

/** A twenty-sided die: play. */
export const DieIcon = () => (
  <Icon>
    <path d="M12 2.5l8 4.5v10l-8 4.5-8-4.5V7z" />
    <path d="M12 8l4 7H8z" />
  </Icon>
);

/** An open book: the rules. */
export const BookIcon = () => (
  <Icon>
    <path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v13c-3-1-6-1-8 1-2-2-5-2-8-1z" />
    <path d="M12 6v13" />
  </Icon>
);

/** A printer. */
export const PrinterIcon = () => (
  <Icon>
    <path d="M7 8V3h10v5M6 17H4v-7h16v7h-2" />
    <path d="M7 14h10v7H7z" />
  </Icon>
);

/** A circle with an i. */
export const InfoIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.500v.5" />
  </Icon>
);

/** A box: content packs. */
export const BoxIcon = () => (
  <Icon>
    <path d="M12 3l8 4v10l-8 4-8-4V7z" />
    <path d="M4 7l8 4 8-4M12 11v10" />
  </Icon>
);

/** A flask: the homebrew editor. */
export const FlaskIcon = () => (
  <Icon>
    <path d="M9 3h6M10 3v6l-5 10a1.500 1.500 0 001.300 2h11.400a1.500 1.500 0 001.300-2l-5-10V3" />
    <path d="M8 14h8" />
  </Icon>
);

/** A globe: translation. */
export const GlobeIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
  </Icon>
);

/** A heart: credits. */
export const HeartIcon = () => (
  <Icon>
    <path d="M12 20s-7-4.400-7-10a4 4 0 017-2.500A4 4 0 0119 10c0 5.600-7 10-7 10z" />
  </Icon>
);
