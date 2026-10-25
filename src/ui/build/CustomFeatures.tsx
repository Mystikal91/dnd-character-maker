import { character, updateCharacter } from "../../app/store";
import { type CustomFeature, MAX_CUSTOM_USES, newCustomFeature } from "../../engine/custom";
import { ui } from "../../i18n/ui";

function change(id: string, patch: Partial<CustomFeature>) {
  updateCharacter((d) => {
    const feature = d.custom?.find((f) => f.id === id);
    if (feature) Object.assign(feature, patch);
  });
}

/** Features the person writes for this character, with the uses they can tick off in play. */
export function CustomFeatures() {
  const features = character.value.custom ?? [];
  return (
    <>
      <p class="muted">{ui("custom.hint")}</p>
      {features.map((f) => (
        <fieldset class="custom-feature" key={f.id}>
          <label class="field">
            <span>{ui("custom.name")}</span>
            <input
              type="text"
              value={f.name}
              onInput={(e) => change(f.id, { name: e.currentTarget.value })}
            />
          </label>
          <label class="field">
            <span>{ui("custom.text")}</span>
            <textarea
              rows={4}
              value={f.text}
              onInput={(e) => change(f.id, { text: e.currentTarget.value })}
            />
          </label>
          <div class="custom-uses">
            <label class="field">
              <span>{ui("custom.uses")}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_CUSTOM_USES}
                value={f.uses ?? ""}
                onInput={(e) => {
                  const n = Number.parseInt(e.currentTarget.value, 10);
                  change(f.id, {
                    uses: Number.isFinite(n) && n > 0 ? Math.min(n, MAX_CUSTOM_USES) : undefined,
                  });
                }}
              />
            </label>
            {f.uses !== undefined && (
              <label class="field">
                <span>{ui("custom.recharge")}</span>
                <select
                  value={f.recharge ?? "long"}
                  onChange={(e) =>
                    change(f.id, { recharge: e.currentTarget.value === "short" ? "short" : "long" })
                  }
                >
                  <option value="short">{ui("play.recoverShort")}</option>
                  <option value="long">{ui("play.recoverLong")}</option>
                </select>
              </label>
            )}
          </div>
          <button
            type="button"
            class="secondary"
            onClick={() =>
              updateCharacter((d) => {
                d.custom = (d.custom ?? []).filter((x) => x.id !== f.id);
              })
            }
          >
            {ui("custom.remove")}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        class="secondary"
        onClick={() =>
          updateCharacter((d) => {
            d.custom = [...(d.custom ?? []), newCustomFeature()];
          })
        }
      >
        {ui("custom.add")}
      </button>
    </>
  );
}
