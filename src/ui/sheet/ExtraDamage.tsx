import { shownSheet } from "../../app/store";
import type { ExtraDamage } from "../../engine/resources";
import { type UiKey, ui } from "../../i18n/ui";

/** The amount an extra damage adds, as text: "+2d6", "+2", "2d8 – 5d8". */
export function extraAmount(extra: ExtraDamage): string {
  switch (extra.kind) {
    case "sneakAttack":
      return `+${extra.dice}`;
    case "rage":
      return `+${extra.bonus}`;
    case "brutalCritical":
      return ui("extra.brutalCritical.amount", { n: extra.dice });
    case "divineSmite":
      return "2d8 – 5d8";
    case "martialArts":
      return extra.dice;
  }
}

export const extraName = (extra: ExtraDamage) => ui(`extra.${extra.kind}.name` as UiKey);
export const extraNote = (extra: ExtraDamage) => ui(`extra.${extra.kind}.note` as UiKey);

/** What the classes add to attacks, with when it applies. Nothing for a character without any. */
export function ExtraDamageList() {
  const extras = shownSheet.value?.extraDamage ?? [];
  if (extras.length === 0) return null;
  return (
    <div class="extra-damage">
      <h4>{ui("extra.title")}</h4>
      <ul class="plain">
        {extras.map((extra) => (
          <li key={extra.kind}>
            <b>{extraName(extra)}</b> {extraAmount(extra)}
            <span class="muted"> · {extraNote(extra)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
