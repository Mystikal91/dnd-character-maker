import { character, content } from "../../app/store";
import { ui } from "../../i18n/ui";
import { PawIcon } from "./icons";

/** A line that says the druid is in the shape of a beast: the whole screen carries the reminder. */
export function BeastStrip({ wide = false }: { wide?: boolean }) {
  const c = content.value;
  const shape = character.value.play.wildShape;
  if (!c || !shape) return null;
  return (
    <output class={`form-strip${wide ? " wide" : ""}`}>
      <PawIcon />
      <span>{ui("play.wildShape.in", { name: c.name(shape.monster) })}</span>
    </output>
  );
}
