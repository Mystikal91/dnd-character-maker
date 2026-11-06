import type { Content } from "../../content/browser";
import type { PlayState } from "../../engine/character";

/** The armor class of the beast the character is in the shape of, if it is in one. */
export function beastArmorClass(
  c: Pick<Content, "index">,
  play: Pick<PlayState, "wildShape">,
): number | undefined {
  const shape = play.wildShape;
  if (!shape) return undefined;
  return (c.index.get(shape.monster)?.data.armorClass as { value: number }[] | undefined)?.[0]
    ?.value;
}
