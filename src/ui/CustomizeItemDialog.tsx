import { useEffect, useRef, useState } from "preact/hooks";
import {
  type CharacterPart,
  type CustomizePlan,
  closeCustomize,
  customizing,
  planCustomize,
  saveCustomItem,
} from "../app/customizeItem";
import { character, content } from "../app/store";
import {
  DAMAGE_TYPES,
  type Draft,
  type DraftTrait,
  draftReady,
  saveDraft,
} from "../homebrew/model";
import { type UiKey, ui } from "../i18n/ui";
import { Check, Cost, type FormApi, Num, Pick, Text } from "./HomebrewPage";
import { PropertyPicker } from "./PropertyPicker";
import { entriesOfKind } from "./build/fields";

const option = (key: string) => ui(`hb.o.${key}` as UiKey);

/** One block of the form, with a title, so a long form on a phone reads as a few short parts. */
function Section({ title, children }: { title: string; children: preact.ComponentChildren }) {
  return (
    <section class="item-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function Form({ itemId, plan }: { itemId: string; plan: CustomizePlan }) {
  const [draft, setDraft] = useState<Draft>(plan.draft);
  const [record, setRecord] = useState(plan.record);
  const held = character.value.inventory.find((i) => i.itemId === itemId);
  const [enchantment, setEnchantment] = useState(held?.enchantment ?? "");
  const [saving, setSaving] = useState(false);
  const c = content.value;

  // The properties that are in the content, and those just written here, which are not saved yet.
  const written = record.pack.entries
    .filter((e) => e.kind === "property")
    .map((e) => ({ id: e.id as string, label: record.strings[`${e.id}.name`] ?? e.id }));
  const known = entriesOfKind("property");
  const options = [...known, ...written.filter((w) => !known.some((k) => k.id === w.id))].sort(
    (a, b) => a.label.localeCompare(b.label),
  );

  const api: FormApi = {
    draft,
    set: (key, value) => setDraft((d) => ({ ...d, values: { ...d.values, [key]: value } })),
    setTraits: (traits: DraftTrait[]) => setDraft((d) => ({ ...d, traits })),
    properties: {
      options,
      create: (name, desc) => {
        const saved = saveDraft(
          record,
          { kind: "property", values: { name, desc }, traits: [] },
          { languages: [] },
        );
        setRecord(saved.record);
        return saved.id;
      },
    },
  };

  const weapon = draft.kind === "weapon";
  const enchantments = c
    ? entriesOfKind("item").filter((o) => c.index.get(o.id)?.data.enchants)
    : [];
  const ready = draftReady(draft);
  const name = c?.name(itemId) ?? itemId;
  const packName = record.name;

  const save = async () => {
    if (!ready || saving) return;
    setSaving(true);
    const part: CharacterPart = { shillelagh: held?.shillelagh === true, enchantment };
    await saveCustomItem(itemId, plan, record, draft, part);
    closeCustomize();
  };

  return (
    <>
      <div class="item-dialog-head">
        <h3>{ui("item.customize.title", { name })}</h3>
        <button type="button" class="link" onClick={closeCustomize}>
          {ui("hb.cancel")}
        </button>
      </div>
      <div class="item-dialog-body">
        <p class="muted">
          {plan.editing
            ? ui("item.customize.hintEdit")
            : ui("item.customize.hintCopy", { pack: packName })}
        </p>

        <Section title={ui("item.customize.basics")}>
          <Text api={api} name="name" />
          <Text api={api} name="desc" area />
        </Section>

        {weapon ? (
          <Section title={ui("item.customize.combat")}>
            <div class="hb-row">
              <Pick
                api={api}
                name="wcategory"
                fallback="simple"
                options={["simple", "martial"].map((id) => ({ id, label: option(id) }))}
              />
              <Pick
                api={api}
                name="wkind"
                fallback="melee"
                options={["melee", "ranged"].map((id) => ({ id, label: option(id) }))}
              />
            </div>
            <div class="hb-row">
              <Text api={api} name="damage" />
              <Pick
                api={api}
                name="damageType"
                fallback="slashing"
                options={DAMAGE_TYPES.map((id) => ({ id, label: option(id) }))}
              />
              <Text api={api} name="versatile" />
            </div>
            <div class="hb-row">
              <Num api={api} name="rangeNormal" min={0} />
              <Num api={api} name="rangeLong" min={0} />
            </div>
            <div class="hb-row">
              <Pick
                api={api}
                name="enhancement"
                fallback="0"
                options={[0, 1, 2, 3].map((n) => ({
                  id: String(n),
                  label: n === 0 ? "—" : `+${n}`,
                }))}
              />
            </div>
            <Check api={api} name="magical" />
          </Section>
        ) : (
          <Section title={ui("item.customize.armor")}>
            <div class="hb-row">
              <Pick
                api={api}
                name="acategory"
                fallback="light"
                options={["light", "medium", "heavy", "shield"].map((id) => ({
                  id,
                  label: option(id),
                }))}
              />
              <Num api={api} name="base" min={0} />
              <Num api={api} name="maxDex" min={0} />
              <Num api={api} name="strMin" min={0} />
            </div>
            <div class="hb-grid">
              <Check api={api} name="dexBonus" />
              <Check api={api} name="stealth" />
              <Check api={api} name="magical" />
            </div>
          </Section>
        )}

        <Section title={ui("item.customize.properties")}>
          <PropertyPicker api={api} />
        </Section>

        <Section title={ui("item.customize.value")}>
          <Cost api={api} />
        </Section>

        {weapon && enchantments.length > 0 && (
          <Section title={ui("item.customize.character")}>
            <label class="field">
              <span>{ui("weapon.enchantment")}</span>
              <select value={enchantment} onChange={(e) => setEnchantment(e.currentTarget.value)}>
                <option value="">{ui("form.none")}</option>
                {enchantments.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </Section>
        )}
      </div>
      <div class="item-dialog-actions">
        <button
          type="button"
          class="primary"
          disabled={!ready || saving}
          onClick={() => void save()}
        >
          {ui("hb.save")}
        </button>
        <button type="button" onClick={closeCustomize}>
          {ui("hb.cancel")}
        </button>
      </div>
    </>
  );
}

/**
 * The window that changes a weapon or an armor of the inventory: its name and its numbers, and its
 * properties, which can be ticked or written anew. The result is saved as an item of the homebrew
 * pack, in place of the one in the inventory.
 */
export function CustomizeItemDialog() {
  const itemId = customizing.value;
  const dialog = useRef<HTMLDialogElement>(null);
  const [plan, setPlan] = useState<{ id: string; plan: CustomizePlan } | undefined>();

  // The form is made once for each item opened, from what the content says at that moment.
  useEffect(() => {
    if (!itemId) {
      setPlan(undefined);
      return;
    }
    const made = planCustomize(itemId);
    if (made) setPlan({ id: itemId, plan: made });
    else closeCustomize();
  }, [itemId]);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (plan && !node.open) node.showModal();
    if (!plan && node.open) node.close();
  }, [plan]);

  if (!itemId) return null;
  return (
    <dialog ref={dialog} class="quick-edit item-dialog" onClose={closeCustomize}>
      {plan && plan.id === itemId && <Form key={itemId} itemId={itemId} plan={plan.plan} />}
    </dialog>
  );
}
