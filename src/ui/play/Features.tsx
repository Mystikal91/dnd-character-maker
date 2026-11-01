import { content, sheet } from "../../app/store";
import { ui } from "../../i18n/ui";
import { Panel, RulesText } from "../sheet/parts";

/** Everything the character has from species, class and feats, to read at the table when it comes up. */
export function PlayFeatures() {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s) return null;
  const ids = [...new Set([...s.traits, ...s.feats, ...s.features])]
    .filter((id) => c.text(id, "desc") && !s.hiddenFeatures.includes(id))
    .sort((a, b) => c.name(a).localeCompare(c.name(b)));
  if (ids.length === 0) return null;
  return (
    <Panel title={ui("play.features")}>
      {ids.map((id) => (
        <RulesText key={id} id={id} name={c.name(id)} text={c.text(id, "desc")} />
      ))}
    </Panel>
  );
}
