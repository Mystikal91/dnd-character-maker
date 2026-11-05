import { type DamageKind, adjustDamage } from "../../engine/play";
import { type UiKey, ui } from "../../i18n/ui";

const KINDS: [DamageKind, UiKey][] = [
  ["normal", "play.damage"],
  ["resistant", "play.damageResistant"],
  ["vulnerable", "play.damageVulnerable"],
];

/**
 * The buttons that take a number the person typed as damage: as it is, halved for a resistance
 * (rage, a spell, an item) or doubled for a vulnerability. The number is the damage of the roll;
 * once typed, each button shows what it will take off. `apply` gets what is dealt.
 */
export function DamageButtons({
  amount,
  apply,
}: {
  amount: number;
  apply: (dealt: number) => void;
}) {
  return (
    <>
      {KINDS.map(([kind, label]) => {
        const dealt = adjustDamage(amount, kind);
        return (
          <button
            type="button"
            key={kind}
            class="danger-btn damage-kind"
            data-kind={kind}
            disabled={amount === 0}
            onClick={() => apply(dealt)}
          >
            {ui(label)}
            {amount > 0 && kind !== "normal" && <small>{`→ ${dealt}`}</small>}
          </button>
        );
      })}
    </>
  );
}
