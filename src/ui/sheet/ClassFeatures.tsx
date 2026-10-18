import { character, content } from "../../app/store";
import type { Content } from "../../content/browser";
import { classData, subclassData } from "../../data/progression";
import type { ClassLevel } from "../../engine/character";
import { ui } from "../../i18n/ui";
import { RulesText } from "./parts";

/** Features of one class (and its subclass) grouped by the level that grants them. */
function featuresByLevel(c: Content, cl: ClassLevel): Map<number, string[]> {
  const byLevel = new Map<number, string[]>();
  const add = (level: number, ids: string[]) => {
    if (ids.length > 0) byLevel.set(level, [...(byLevel.get(level) ?? []), ...ids]);
  };
  const entry = c.index.get(cl.classId);
  if (entry) for (const row of classData(entry).levels) add(row.level, row.features);
  const sub = cl.subclassId ? c.index.get(cl.subclassId) : undefined;
  if (sub) for (const row of subclassData(sub).levels) add(row.level, row.features);
  return byLevel;
}

function LevelFrame({
  c,
  level,
  features,
  locked,
}: {
  c: Content;
  level: number;
  features: string[];
  locked: boolean;
}) {
  return (
    <article class={`card level-frame${locked ? " locked" : ""}`}>
      <span class="level-badge">
        <small>{ui("sheet.levelBadge")}</small>
        {level}
      </span>
      {features.map((id) => (
        <RulesText key={id} name={c.name(id)} text={c.text(id, "desc")} />
      ))}
    </article>
  );
}

/** One framed box per level, filled with the class features from the rules. */
export function ClassFeatures() {
  const c = content.value;
  const ch = character.value;
  if (!c || ch.classes.length === 0) return null;

  return (
    <div class="class-features">
      {ch.classes.map((cl) => {
        const levels = [...featuresByLevel(c, cl).entries()].sort(([a], [b]) => a - b);
        const reached = levels.filter(([level]) => level <= cl.level);
        const ahead = levels.filter(([level]) => level > cl.level);
        return (
          <section key={cl.classId} class="class-block">
            <h3 class="class-features-title">
              {ui("sheet.classFeatures")}
              {ch.classes.length > 1 && ` — ${c.name(cl.classId)}`}
            </h3>
            {reached.map(([level, features]) => (
              <LevelFrame key={level} c={c} level={level} features={features} locked={false} />
            ))}
            {ahead.length > 0 && (
              <details class="higher-levels">
                <summary>{ui("sheet.higherLevels", { count: ahead.length })}</summary>
                {ahead.map(([level, features]) => (
                  <LevelFrame key={level} c={c} level={level} features={features} locked />
                ))}
              </details>
            )}
          </section>
        );
      })}
    </div>
  );
}
