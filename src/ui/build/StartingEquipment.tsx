import { character, content } from "../../app/store";
import type { Content } from "../../content/browser";
import type { Entry } from "../../data/schema";
import { ui } from "../../i18n/ui";

const MAX_LINES = 12;

/** The choices the rules give a class for its starting equipment, as written in its language. */
function classLines(c: Content, classId: string): string[] {
  const lines: string[] = [];
  for (let n = 1; n <= MAX_LINES; n++) {
    const line = c.text(classId, `startingEquipment.${n}`);
    if (!line) break;
    lines.push(line);
  }
  return lines;
}

/** What an entry hands out without a choice, as a short list ("Explorer's Pack, Javelin ×4"). */
function fixedItems(c: Content, entry: Entry): string {
  const items = (entry.data.startingEquipment ?? []) as { item: string; quantity: number }[];
  return items
    .map((i) => (i.quantity > 1 ? `${c.name(i.item)} ×${i.quantity}` : c.name(i.item)))
    .join(", ");
}

/**
 * A reminder, in the Equipment step, of what the first class and the background start with:
 * the choices the rules give, as text. What to take is added from the lists below, where a pack
 * adds everything it holds.
 */
export function StartingEquipment() {
  const c = content.value;
  const ch = character.value;
  if (!c) return null;
  const classId = ch.classes[0]?.classId;
  const cls = classId ? c.index.get(classId) : undefined;
  const background = ch.choices.background ? c.index.get(ch.choices.background) : undefined;

  const sections = [
    cls && classId
      ? { id: classId, lines: classLines(c, classId), also: fixedItems(c, cls) }
      : undefined,
    background ? { id: background.id, lines: [], also: fixedItems(c, background) } : undefined,
  ].filter((s): s is { id: string; lines: string[]; also: string } =>
    Boolean(s && (s.lines.length > 0 || s.also)),
  );
  if (sections.length === 0) return null;

  return (
    <details class="starting-equipment" open>
      <summary>{ui("equipment.starting")}</summary>
      <p class="muted">{ui("equipment.startingHint")}</p>
      {sections.map((s) => (
        <section key={s.id}>
          <h5>{c.name(s.id)}</h5>
          <ul>
            {s.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
            {s.also && <li>{ui("equipment.startingAlso", { items: s.also })}</li>}
          </ul>
        </section>
      ))}
    </details>
  );
}
