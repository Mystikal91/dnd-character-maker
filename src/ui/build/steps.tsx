import { useState } from "preact/hooks";
import { character, content, sheet, updateCharacter } from "../../app/store";
import { itemData } from "../../data/items";
import { proficiencyKeys } from "../../engine/equipment";
import { addToInventory, packContents } from "../../engine/gear";
import { ui } from "../../i18n/ui";
import { ItemTag, itemLabel } from "../ItemTag";
import { WeaponMagic } from "../WeaponMagic";
import { BackgroundInfo, SpeciesInfo } from "./EntryInfo";
import { StartingEquipment } from "./StartingEquipment";
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
  const [filter, setFilter] = useState("");
  const [onlyProficient, setOnlyProficient] = useState(false);
  const held = sheet.value ? proficiencyKeys(sheet.value.proficiencies) : undefined;
  // With the tick on, armor and weapons the character is not proficient with are left out.
  const proficientIn = (o: { id: string }) => {
    const entry = index?.get(o.id);
    if (!onlyProficient || !held || !entry) return true;
    const data = itemData(entry);
    const keys = (data.armor ?? data.weapon)?.proficiency ?? [];
    return keys.some((k) => held.has(k));
  };
  const wanted = filter.trim().toLowerCase();
  const labelled = (o: { id: string; label: string }) => ({ id: o.id, label: itemLabel(o.id) });
  const found = (o: { label: string }) => !wanted || o.label.toLowerCase().includes(wanted);
  const armor = itemOptions("armor").filter(proficientIn).map(labelled).filter(found);
  const weapons = itemOptions("weapon").filter(proficientIn).map(labelled).filter(found);
  const packs = entriesOfKind("item")
    .filter((o) => {
      const entry = index?.get(o.id);
      return entry && packContents(entry).length > 0;
    })
    .filter(found);
  const magic = entriesOfKind("item")
    .filter((o) => index?.get(o.id)?.data.rarity && !index.get(o.id)?.data.enchants)
    .filter(found);

  return (
    <>
      <StartingEquipment />
      <label class="field">
        <span>{ui("form.searchItems")}</span>
        <input type="search" value={filter} onInput={(e) => setFilter(e.currentTarget.value)} />
      </label>
      <label class="check">
        <input
          type="checkbox"
          checked={onlyProficient}
          onChange={(e) => setOnlyProficient(e.currentTarget.checked)}
        />
        <span>{ui("form.onlyProficient")}</span>
      </label>
      <label class="field">
        <span>{ui("form.addItem")}</span>
        <select
          value=""
          onChange={(e) => {
            const itemId = e.currentTarget.value;
            if (!itemId) return;
            // A pack adds everything it holds instead of itself.
            const entry = index?.get(itemId);
            const contents = entry ? packContents(entry) : [];
            updateCharacter((d) => {
              if (contents.length > 0)
                for (const part of contents) addToInventory(d.inventory, part.item, part.quantity);
              else addToInventory(d.inventory, itemId, 1);
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
          {packs.length > 0 && (
            <optgroup label={ui("form.packGroup")}>
              {packs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          )}
          {magic.length > 0 && (
            <optgroup label={ui("form.magicGroup")}>
              {magic.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <p class="muted">{ui("sheet.equipHint")}</p>
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
              <span class="equip-tag">{ui("form.equipped")}</span>
              {content.value?.name(item.itemId)}
              {item.quantity > 1 && ` ×${item.quantity}`}
              <ItemTag id={item.itemId} />
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
            <WeaponMagic item={item} />
          </li>
        ))}
      </ul>
    </>
  );
}
