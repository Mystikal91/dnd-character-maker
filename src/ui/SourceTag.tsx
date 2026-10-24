import { content, sheet } from "../app/store";
import { ui } from "../i18n/ui";

/** Where a feature comes from, as text: "Rogue Lv. 1", or the species or background name. */
export function sourceLabel(id: string): string | undefined {
  const source = sheet.value?.featureSources[id];
  const c = content.value;
  if (!source || !c) return undefined;
  const name = c.name(source.entry);
  return source.level === undefined ? name : `${name} ${ui("sheet.levelBadge")} ${source.level}`;
}

/** The source of a feature in brackets after its name, for the printed sheet. */
export function SourceTag({ id }: { id: string }) {
  const label = sourceLabel(id);
  return label ? <span class="p-source"> [{label}]</span> : null;
}
