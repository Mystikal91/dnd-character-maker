import { signal } from "@preact/signals";

/** Which tab of the About page is open. */
export const aboutTab = signal<"home" | "roadmap" | "changelog">("home");
