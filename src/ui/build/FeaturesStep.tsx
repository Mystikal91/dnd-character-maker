import { character, content, sheet, updateCharacter } from "../../app/store";
import { MAX_CUSTOM_USES } from "../../engine/custom";
import { type FeatureSetting, countedBy } from "../../engine/uses";
import { ui } from "../../i18n/ui";
import { Paragraphs } from "../sheet/parts";
import { CustomFeatures } from "./CustomFeatures";

/** Keeps only what differs from the data: a setting with nothing in it is dropped. */
function change(id: string, patch: Partial<FeatureSetting>) {
  updateCharacter((d) => {
    const next: FeatureSetting = { ...d.featureSettings?.[id], ...patch };
    const clean = Object.fromEntries(
      Object.entries(next).filter(([, value]) => value !== undefined && value !== false),
    ) as FeatureSetting;
    const others = Object.entries(d.featureSettings ?? {}).filter(([key]) => key !== id);
    const all = Object.keys(clean).length === 0 ? others : [...others, [id, clean] as const];
    d.featureSettings = all.length === 0 ? undefined : Object.fromEntries(all);
  });
}

/**
 * The features, traits and feats the character has, each with the uses it has between rests
 * (read from the data where it says, set by the person where it does not) and a switch to hide it
 * from the sheet. The features the person writes come after them.
 */
export function FeaturesStep() {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s) return null;
  const settings = character.value.featureSettings ?? {};
  const groups = [
    { title: "features.species", ids: s.traits },
    { title: "features.feats", ids: s.feats },
    { title: "features.class", ids: s.features },
  ].map((group) => ({
    ...group,
    ids: [...new Set(group.ids)].filter((id) => c.text(id, "desc") || countedBy(s.resources, id)),
  }));
  return (
    <>
      <p class="muted">{ui("features.hint")}</p>
      {groups.map(
        (group) =>
          group.ids.length > 0 && (
            <section key={group.title}>
              <h4>{ui(group.title as "features.species")}</h4>
              {group.ids.map((id) => {
                const setting = settings[id] ?? {};
                const counted = countedBy(s.resources, id);
                const hidden = setting.hidden === true;
                return (
                  <details class={`feature-row${hidden ? " is-hidden" : ""}`} key={id}>
                    <summary>
                      {c.name(id)}
                      <small class="muted">
                        {" "}
                        {counted &&
                          `· ${counted.max} × ${ui(counted.recovery === "short" ? "play.recoverShort" : "play.recoverLong")}`}
                        {hidden && ` · ${ui("features.hiddenTag")}`}
                      </small>
                    </summary>
                    <Paragraphs text={c.text(id, "desc")} />
                    <div class="custom-uses">
                      <label class="field">
                        <span>{ui("features.uses")}</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={MAX_CUSTOM_USES}
                          placeholder={counted ? String(counted.max) : ""}
                          value={setting.uses ?? ""}
                          onInput={(e) => {
                            const n = Number.parseInt(e.currentTarget.value, 10);
                            change(id, {
                              uses:
                                Number.isFinite(n) && n >= 0
                                  ? Math.min(n, MAX_CUSTOM_USES)
                                  : undefined,
                            });
                          }}
                        />
                      </label>
                      {(counted || setting.uses !== undefined) && (
                        <label class="field">
                          <span>{ui("custom.recharge")}</span>
                          <select
                            value={setting.recharge ?? counted?.recovery ?? "long"}
                            onChange={(e) =>
                              change(id, {
                                recharge: e.currentTarget.value === "short" ? "short" : "long",
                              })
                            }
                          >
                            <option value="short">{ui("play.recoverShort")}</option>
                            <option value="long">{ui("play.recoverLong")}</option>
                          </select>
                        </label>
                      )}
                    </div>
                    <p class="muted">
                      {setting.uses !== undefined
                        ? ui("features.usesSet")
                        : counted
                          ? ui("features.usesData")
                          : ui("features.usesNone")}
                    </p>
                    {s.resources
                      .filter((r) => r.spell !== undefined && r.entry === id)
                      .map((r) => (
                        <label class="field" key={r.id}>
                          <span>{ui("resource.freeSpell", { name: c.name(r.spell ?? "") })}</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={MAX_CUSTOM_USES}
                            placeholder="1"
                            value={settings[r.id]?.uses ?? ""}
                            onInput={(e) => {
                              const n = Number.parseInt(e.currentTarget.value, 10);
                              change(r.id, {
                                uses:
                                  Number.isFinite(n) && n >= 0
                                    ? Math.min(n, MAX_CUSTOM_USES)
                                    : undefined,
                              });
                            }}
                          />
                          <small class="muted">{ui("features.freeSpellHint")}</small>
                        </label>
                      ))}
                    <label class="check">
                      <input
                        type="checkbox"
                        checked={hidden}
                        onChange={(e) => change(id, { hidden: e.currentTarget.checked })}
                      />{" "}
                      {ui("features.hide")}
                    </label>
                  </details>
                );
              })}
            </section>
          ),
      )}
      <h4>{ui("features.custom")}</h4>
      <CustomFeatures />
    </>
  );
}
