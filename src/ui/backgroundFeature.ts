import type { Content } from "../content/browser";
import type { Character } from "../engine/character";

/**
 * The feature a background gives: its own, or the optional one the character took in its place
 * (an option whose data says `backgroundFeature`, switched on in the optional rules).
 */
export function backgroundFeature(
  ch: Pick<Character, "options" | "choices">,
  c: Content,
): { name: string | undefined; text: string | undefined } {
  const background = ch.choices.background;
  const chosen = (ch.options ?? []).find(
    (id) => c.index.get(id)?.data.backgroundFeature === true && c.text(id, "desc"),
  );
  if (chosen) return { name: c.name(chosen), text: c.text(chosen, "desc") };
  return {
    name: background ? c.text(background, "featureName") : undefined,
    text: background ? c.text(background, "featureDesc") : undefined,
  };
}

/** Whether an entry of the kind `option` is an optional feature in place of a background's own. */
export const isBackgroundFeatureOption = (id: string, c: Content): boolean =>
  c.index.get(id)?.data.backgroundFeature === true;
