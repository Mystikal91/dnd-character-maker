import type { ComponentChildren } from "preact";
import { content, sheet } from "../../app/store";
import type { DamageResult } from "../../engine/equipment";
import { signed, ui } from "../../i18n/ui";
import { Panel } from "./parts";

function Stat({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="stat">
      <div class="stat-value">{children}</div>
      <div class="stat-label">{label}</div>
    </div>
  );
}

const formatDamage = (d: DamageResult) =>
  `${d.dice}${d.bonus === 0 ? "" : signed(d.bonus)} ${d.type}`;

/** Armor class, initiative, speed, hit points and hit dice. */
export function CoreStats() {
  const s = sheet.value;
  if (!s) return null;
  const hitDice = Object.entries(s.hitPoints.hitDice)
    .map(([die, n]) => `${n}${die}`)
    .join(" + ");

  return (
    <>
      <div class="stat-row">
        <Stat label={ui("sheet.armorClass")}>{s.armorClass.value}</Stat>
        <Stat label={ui("sheet.initiative")}>{signed(s.initiative)}</Stat>
        <Stat label={ui("sheet.speed")}>
          {s.speed === undefined ? "—" : ui("sheet.speedValue", { feet: s.speed })}
        </Stat>
      </div>
      {s.armorClass.stealthDisadvantage && <p class="note">{ui("sheet.stealthDisadvantage")}</p>}
      <div class="stat-row stat-row-2">
        <Stat label={ui("sheet.hitPoints")}>{s.hitPoints.max}</Stat>
        <Stat label={ui("sheet.hitDice")}>{hitDice || "—"}</Stat>
      </div>
    </>
  );
}

/** Equipped weapons with their attack bonus and damage. */
export function Attacks() {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s) return null;

  return (
    <Panel title={ui("sheet.attacks")}>
      {s.attacks.length === 0 ? (
        <p class="muted">{ui("sheet.noAttacks")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{ui("print.name")}</th>
              <th>{ui("sheet.attackBonus")}</th>
              <th>{ui("sheet.damage")}</th>
            </tr>
          </thead>
          <tbody>
            {s.attacks.map((a) => (
              <tr key={a.itemId}>
                <td>{c.name(a.itemId)}</td>
                <td>{signed(a.attackBonus)}</td>
                <td>
                  {a.damage && formatDamage(a.damage)}
                  {a.twoHandedDamage && (
                    <div class="muted">
                      {formatDamage(a.twoHandedDamage)} ({ui("sheet.twoHanded")})
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
