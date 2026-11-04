import type { Content } from "../content/browser";
import { needWords } from "../engine/optionNeeds";
import { ui } from "../i18n/ui";

/**
 * What an option asks for, in words: the text the book gives (Aurora's prerequisite), or the level,
 * the scores and the entries its requirement names. Empty when there is nothing to tell.
 */
export function needLabel(c: Content, ruleset: string, option: string, expression: string): string {
  const written = c.text(option, "prerequisite");
  const what =
    written ??
    needWords(expression, (id) => c.index.has(id))
      .map((w) => {
        if ("level" in w) return ui("choice.needLevel", { level: w.level });
        if ("ability" in w)
          return ui("choice.needScore", {
            ability: c.name(`${ruleset}:ability/${w.ability}`),
            n: w.minimum,
          });
        return c.name(w.id);
      })
      .join(", ");
  return what ? ui("choice.needs", { what }) : "";
}
