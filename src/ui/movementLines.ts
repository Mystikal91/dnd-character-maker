import type { Sense } from "../data/schema";
import type { Movement } from "../engine/movement";
import { type UiKey, ui } from "../i18n/ui";
import { distance } from "../i18n/units";

/**
 * The speeds other than walking and the senses as `[name, value]` pairs: "Climb", "30 ft (half
 * speed)". `givenOnly` leaves out the climbing and swimming that everyone has at half speed.
 */
export function movementLines(
  movement: Movement,
  senses: Partial<Record<Sense, number>>,
  givenOnly = false,
): [string, string][] {
  const speeds = (["climb", "swim", "fly", "burrow"] as const).flatMap((mode) => {
    const speed = movement[mode];
    if (!speed || (givenOnly && speed.half)) return [];
    const half = speed.half ? ` (${ui("sheet.move.half")})` : "";
    return [
      [ui(`sheet.move.${mode}` as UiKey), `${distance(speed.feet)}${half}`] as [string, string],
    ];
  });
  const sensed = (["darkvision", "blindsight", "tremorsense", "truesight"] as const).flatMap(
    (sense) => {
      const range = senses[sense];
      return range
        ? [[ui(`sheet.sense.${sense}` as UiKey), distance(range)] as [string, string]]
        : [];
    },
  );
  return [...speeds, ...sensed];
}
