import { content } from "../../app/store";
import { ui } from "../../i18n/ui";

const RULESET = "srd51";

/** Entries of one kind from the active ruleset, sorted by their display name. */
export function entriesOfKind(kind: string, parent?: string) {
  const c = content.value;
  if (!c) return [];
  return [...c.index.values()]
    .filter((e) => e.kind === kind && e.id.startsWith(`${RULESET}:`))
    .filter((e) => parent === undefined || e.parent === parent)
    .map((e) => ({ id: e.id, label: c.name(e.id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

interface SelectProps {
  label: string;
  value: string | undefined;
  options: { id: string; label: string }[];
  onChange: (value: string | undefined) => void;
}

export function Select({ label, value, options, onChange }: SelectProps) {
  return (
    <label class="field">
      <span>{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange((e.currentTarget as HTMLSelectElement).value || undefined)}
      >
        <option value="">{ui("form.none")}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function parseWhole(value: string, fallback: number) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}
