import type { Content } from "../content/browser";
import type { AttackResult } from "../engine/equipment";
import { ui } from "../i18n/ui";

/** The name of what an attack is made with: the weapon's, or "Unarmed strike" for bare hands. */
export const attackName = (c: Content, a: AttackResult): string =>
  a.unarmed ? ui("play.unarmed") : c.name(a.itemId);
