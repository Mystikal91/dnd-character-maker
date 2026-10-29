/**
 * The mark of Heroquill: an H whose crossbar is a quill. It takes the colours of the colour set
 * (the stems and the quill in the accent, the quill's outline in the surface), so it sits on any
 * of them; `public/icon.svg` is the same drawing in the fixed colours of the app icon.
 */
export function Logo({ class: className }: { class?: string }) {
  return (
    <svg viewBox="20 24 100 92" role="img" aria-label="Heroquill" class={className}>
      <title>Heroquill</title>
      <path
        d="M46 36V104M94 36V104"
        stroke="var(--accent)"
        stroke-width="9"
        stroke-linecap="round"
        fill="none"
      />
      <g transform="translate(70 70) rotate(20) scale(0.8) translate(-52 -51)">
        <path
          d="M12 94C20 72 30 52 44 36C58 20 74 12 92 8C90 28 80 50 62 64C48 76 30 86 12 94Z"
          fill="var(--surface)"
          stroke="var(--surface)"
          stroke-width="10"
          stroke-linejoin="round"
        />
        <path
          d="M12 94C20 72 30 52 44 36C58 20 74 12 92 8C90 28 80 50 62 64C48 76 30 86 12 94Z"
          fill="var(--accent)"
        />
        <path
          d="M16 90L84 14"
          stroke="var(--surface)"
          stroke-width="3.5"
          stroke-linecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
}
