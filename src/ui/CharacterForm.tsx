import type { JSX } from "preact";
import { character, content, updateCharacter } from "../app/store";
import { itemData } from "../data/items";
import { ABILITIES } from "../data/schema";
import { ui } from "../i18n/ui";

const RULESET = "srd51";

function entriesOfKind(kind: string, parent?: string) {
  const c = content.value;
  if (!c) return [];
  return [...c.index.values()]
    .filter((e) => e.kind === kind && e.id.startsWith(`${RULESET}:`))
    .filter((e) => parent === undefined || e.parent === parent)
    .map((e) => ({ id: e.id, label: c.name(e.id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

interface SelectProps {
  label: string;
  value: string | undefined;
  options: { id: string; label: string }[];
  onChange: (value: string | undefined) => void;
}

function Select({ label, value, options, onChange }: SelectProps) {
  return (
    <label class="field">
      <span>{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange((e.currentTarget as HTMLSelectElement).value || undefined)}
      >
        <option value="">{ui("form.none")}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const asNumber = (e: JSX.TargetedEvent<HTMLInputElement>, fallback: number) => {
  const n = Number.parseInt(e.currentTarget.value, 10);
  return Number.isFinite(n) ? n : fallback;
};

export function CharacterForm() {
  const c = character.value;
  const mainClass = c.classes[0];
  const index = content.value?.index;

  const itemOptions = (group: "armor" | "weapon") =>
    entriesOfKind("item").filter((o) => {
      const entry = index?.get(o.id);
      return entry && itemData(entry)[group];
    });
  const armor = itemOptions("armor");
  const weapons = itemOptions("weapon");

  return (
    <form class="card form" onSubmit={(e) => e.preventDefault()}>
      <h2>{ui("form.title")}</h2>

      <label class="field">
        <span>{ui("form.name")}</span>
        <input
          type="text"
          value={c.name}
          onInput={(e) =>
            updateCharacter((d) => {
              d.name = e.currentTarget.value;
            })
          }
        />
      </label>

      <Select
        label={ui("form.species")}
        value={c.choices.species}
        options={entriesOfKind("species")}
        onChange={(id) =>
          updateCharacter((d) => {
            d.choices.species = id;
            d.choices.subspecies = undefined;
          })
        }
      />
      {c.choices.species && entriesOfKind("subspecies", c.choices.species).length > 0 && (
        <Select
          label={ui("form.subspecies")}
          value={c.choices.subspecies}
          options={entriesOfKind("subspecies", c.choices.species)}
          onChange={(id) =>
            updateCharacter((d) => {
              d.choices.subspecies = id;
            })
          }
        />
      )}

      <Select
        label={ui("form.class")}
        value={mainClass?.classId}
        options={entriesOfKind("class")}
        onChange={(id) =>
          updateCharacter((d) => {
            d.classes = id ? [{ classId: id, level: d.classes[0]?.level ?? 1 }] : [];
          })
        }
      />
      {mainClass && (
        <>
          <label class="field">
            <span>{ui("form.level")}</span>
            <input
              type="number"
              min={1}
              max={20}
              value={mainClass.level}
              onInput={(e) =>
                updateCharacter((d) => {
                  const first = d.classes[0];
                  if (first) first.level = Math.min(20, Math.max(1, asNumber(e, 1)));
                })
              }
            />
          </label>
          {entriesOfKind("subclass", mainClass.classId).length > 0 && (
            <Select
              label={ui("form.subclass")}
              value={mainClass.subclassId}
              options={entriesOfKind("subclass", mainClass.classId)}
              onChange={(id) =>
                updateCharacter((d) => {
                  const first = d.classes[0];
                  if (first) first.subclassId = id;
                })
              }
            />
          )}
        </>
      )}

      <fieldset>
        <legend>{ui("form.abilities")}</legend>
        <div class="ability-inputs">
          {ABILITIES.map((ability) => (
            <label class="field" key={ability}>
              <span>{content.value?.text(`${RULESET}:ability/${ability}`, "abbreviation")}</span>
              <input
                type="number"
                min={1}
                max={30}
                value={c.abilityBase[ability]}
                onInput={(e) =>
                  updateCharacter((d) => {
                    d.abilityBase[ability] = asNumber(e, 10);
                  })
                }
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>{ui("form.equipment")}</legend>
        <label class="field">
          <span>{ui("form.addItem")}</span>
          <select
            value=""
            onChange={(e) => {
              const itemId = e.currentTarget.value;
              if (!itemId) return;
              updateCharacter((d) => {
                const existing = d.inventory.find((i) => i.itemId === itemId);
                if (existing) existing.quantity += 1;
                else d.inventory.push({ itemId, quantity: 1, equipped: false });
              });
            }}
          >
            <option value="">{ui("form.chooseItem")}</option>
            <optgroup label={ui("form.armorGroup")}>
              {armor.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </optgroup>
            <optgroup label={ui("form.weaponGroup")}>
              {weapons.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <ul class="inventory">
          {c.inventory.map((item) => (
            <li key={item.itemId}>
              <label>
                <input
                  type="checkbox"
                  checked={item.equipped}
                  onChange={(e) =>
                    updateCharacter((d) => {
                      const found = d.inventory.find((i) => i.itemId === item.itemId);
                      if (found) found.equipped = e.currentTarget.checked;
                    })
                  }
                />
                <span class="sr-only">{ui("form.equipped")}</span>
                {content.value?.name(item.itemId)}
                {item.quantity > 1 && ` ×${item.quantity}`}
              </label>
              <button
                type="button"
                class="link"
                onClick={() =>
                  updateCharacter((d) => {
                    d.inventory = d.inventory.filter((i) => i.itemId !== item.itemId);
                  })
                }
              >
                {ui("form.remove")}
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
    </form>
  );
}
