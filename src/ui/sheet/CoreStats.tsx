import type { ComponentChildren } from "preact";
import { character, content, isForced, sheet, updateCharacter } from "../../app/store";
import type { DamageResult } from "../../engine/equipment";
import { OVERRIDE } from "../../engine/overrides";
import { type UiKey, signed, ui } from "../../i18n/ui";
import { distance } from "../../i18n/units";
import { Panel } from "./parts";

export function Stat({
  label,
  forced = false,
  children,
}: {
  label: string;
  forced?: boolean;
  children: ComponentChildren;
}) {
  return (
    <div
      class={`stat${forced ? " forced" : ""}`}
      title={forced ? ui("freeEdit.forced") : undefined}
    >
      <div class="stat-value">{children}</div>
      <div class="stat-label">{label}</div>
    </div>
  );
}

const formatDamage = (d: DamageResult) =>
  `${d.dice}${d.bonus === 0 ? "" : signed(d.bonus)} ${d.type}`;

/** Where the bonuses of features and choices come from, so a number can be trusted. */
function Bonuses() {
  const s = sheet.value;
  const c = content.value;
  if (!s || !c || s.bonuses.length === 0) return null;
  return (
    <details class="bonuses">
      <summary>{ui("sheet.bonuses")}</summary>
      <ul class="plain">
        {s.bonuses.map((b) => (
          <li key={`${b.target}-${b.source}-${b.value}`}>
            {ui(`sheet.bonus.${b.target}` as UiKey, {
              value:
                b.target === "speed"
                  ? `${b.value > 0 ? "+" : "-"}${distance(Math.abs(b.value))}`
                  : signed(b.value),
            })}{" "}
            <span class="muted">· {c.name(b.source)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

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
        <Stat label={ui("sheet.armorClass")} forced={isForced(OVERRIDE.armorClass)}>
          {s.armorClass.value}
        </Stat>
        <Stat label={ui("sheet.initiative")} forced={isForced(OVERRIDE.initiative)}>
          {signed(s.initiative)}
        </Stat>
        <Stat label={ui("sheet.speed")} forced={isForced(OVERRIDE.speed)}>
          {s.speed === undefined ? "—" : distance(s.speed)}
        </Stat>
      </div>
      {s.armorClass.stealthDisadvantage && <p class="note">{ui("sheet.stealthDisadvantage")}</p>}
      <Bonuses />
      <div class="stat-row stat-row-2">
        <Stat label={ui("sheet.hitPoints")} forced={isForced(OVERRIDE.hitPoints)}>
          {s.hitPoints.max}
        </Stat>
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
  // Weapons in the inventory that are not equipped yet: the sheet offers to equip them.
  const carried = character.value.inventory
    .filter((i) => !i.equipped && c.index.get(i.itemId)?.data.weapon !== undefined)
    .map((i) => i.itemId);

  return (
    <Panel title={ui("sheet.attacks")}>
      {s.attacks.length === 0 ? (
        <>
          <p class="muted">
            {ui(carried.length > 0 ? "sheet.noAttacksCarried" : "sheet.noAttacks")}
          </p>
          {carried.map((id) => (
            <button
              type="button"
              class="secondary"
              key={id}
              onClick={() =>
                updateCharacter((d) => {
                  const found = d.inventory.find((x) => x.itemId === id);
                  if (found) found.equipped = true;
                })
              }
            >
              {ui("sheet.equipItem", { name: c.name(id) })}
            </button>
          ))}
        </>
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
