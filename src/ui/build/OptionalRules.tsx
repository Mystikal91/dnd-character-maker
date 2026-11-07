import { character, content, updateCharacter } from "../../app/store";
import { ui } from "../../i18n/ui";
import { Paragraphs } from "../sheet/parts";
import { entriesOfKind } from "./fields";

type Group = "rules" | "classFeatures" | "backgroundFeatures";

/**
 * The rules of the packs that can be switched on for this character, such as Tasha's customised
 * origin, the optional features of a class and the optional features that stand in for a
 * background's own (only one of those at a time).
 */
export function OptionalRules() {
  const all = entriesOfKind("option");
  if (all.length === 0) return null;
  const c = content.value;
  const on = character.value.options ?? [];
  const groupOf = (id: string): Group => {
    const data = c?.index.get(id)?.data;
    if (data?.backgroundFeature === true) return "backgroundFeatures";
    return data?.optionalFeature === true ? "classFeatures" : "rules";
  };
  const toggle = (id: string, checked: boolean) =>
    updateCharacter((d) => {
      // One optional feature takes the place of the background's: taking another puts the first back.
      const exclusive = groupOf(id) === "backgroundFeatures";
      const rest = (d.options ?? []).filter(
        (other) =>
          other !== id && !(checked && exclusive && groupOf(other) === "backgroundFeatures"),
      );
      d.options = checked ? [...rest, id] : rest;
    });
  const row = (option: (typeof all)[number]) => (
    <div key={option.id}>
      <label class="check">
        <input
          type="checkbox"
          checked={on.includes(option.id)}
          onChange={(e) => toggle(option.id, e.currentTarget.checked)}
        />
        <span>{option.label}</span>
      </label>
      {c && (
        <details class="muted">
          <summary>{ui("build.info.more")}</summary>
          <Paragraphs text={c.text(option.id, "desc")} />
        </details>
      )}
    </div>
  );
  const rules = all.filter((o) => groupOf(o.id) === "rules");
  const classFeatures = all.filter((o) => groupOf(o.id) === "classFeatures");
  const backgroundFeatures = all.filter((o) => groupOf(o.id) === "backgroundFeatures");
  return (
    <details class="optional-rules">
      <summary>
        {ui("build.options.title")}
        {on.length > 0 && ` (${on.length})`}
      </summary>
      {rules.length > 0 && (
        <>
          <p class="muted">{ui("build.options.hint")}</p>
          {rules.map(row)}
        </>
      )}
      {classFeatures.length > 0 && (
        <section>
          <h4>{ui("build.options.classFeatures")}</h4>
          <p class="muted">{ui("build.options.classFeaturesHint")}</p>
          {classFeatures.map(row)}
        </section>
      )}
      {backgroundFeatures.length > 0 && (
        <section>
          <h4>{ui("build.options.backgroundFeatures")}</h4>
          <p class="muted">{ui("build.options.backgroundFeaturesHint")}</p>
          {backgroundFeatures.map(row)}
        </section>
      )}
    </details>
  );
}
