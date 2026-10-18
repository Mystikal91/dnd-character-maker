import { character, content } from "../../app/store";
import { ui } from "../../i18n/ui";

/** Name banner, who the character is, and the class banner. */
export function SheetHeader() {
  const c = content.value;
  const ch = character.value;
  if (!c) return null;
  const name = c.name;

  const first = ch.classes[0];
  const classTitle = ch.classes.map((cl) => name(cl.classId)).join(" / ") || ui("sheet.noClass");
  const totalLevel = ch.classes.reduce((sum, cl) => sum + cl.level, 0);
  const classLabel = first?.subclassId
    ? name(first.subclassId)
    : ui("sheet.levelLabel", { level: totalLevel });

  const species = [ch.choices.species, ch.choices.subspecies]
    .filter((id): id is string => Boolean(id))
    .map(name)
    .join(", ");

  return (
    <header class="sheet-header">
      <div class="banner banner-name">
        <h2>{ch.name || ui("sheet.unnamed")}</h2>
        <span class="banner-label">{ui("sheet.name")}</span>
      </div>

      <dl class="card sheet-info">
        <div>
          <dd>{species || "—"}</dd>
          <dt>{ui("print.species")}</dt>
        </div>
        <div>
          <dd>{ch.choices.background ? name(ch.choices.background) : "—"}</dd>
          <dt>{ui("print.background")}</dt>
        </div>
        <div>
          <dd>{ui("sheet.levelLabel", { level: totalLevel })}</dd>
          <dt>{ui("form.level")}</dt>
        </div>
      </dl>

      <div class="banner banner-class">
        <h2>{classTitle}</h2>
        <span class="banner-label">{classLabel}</span>
      </div>
    </header>
  );
}
