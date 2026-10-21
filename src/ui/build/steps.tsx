import { character, content, updateCharacter } from "../../app/store";
import { itemData } from "../../data/items";
import { ui } from "../../i18n/ui";
import { BackgroundInfo, SpeciesInfo } from "./EntryInfo";
import { Select, entriesOfKind } from "./fields";

/** Name, species, subspecies and background. */
export function OriginStep() {
  const c = character.value;
  return (
    <div class="step-split">
      <div class="step-fields">
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
          label={ui("form.background")}
          value={c.choices.background}
          options={entriesOfKind("background")}
          onChange={(id) =>
            updateCharacter((d) => {
              d.choices.background = id;
            })
          }
        />
      </div>
      <div class="step-info">
        <SpeciesInfo />
        <BackgroundInfo />
      </div>
    </div>
  );
}

/** Armor and weapons to carry, and which of them are worn or wielded. */
export function EquipmentStep() {
  const c = character.value;
  const index = content.value?.index;
  const itemOptions = (group: "armor" | "weapon") =>
    entriesOfKind("item").filter((o) => {
      const entry = index?.get(o.id);
      return entry && itemData(entry)[group];
    });
  const armor = itemOptions("armor");
  const weapons = itemOptions("weapon");

  return (
    <>
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
    </>
  );
}
