import { SHEET_GROUPS, type SheetGroup, sheetGroup, showSheetGroup } from "../../app/sheetView";
import { sheet } from "../../app/store";
import { type UiKey, signed, ui } from "../../i18n/ui";
import { distance } from "../../i18n/units";
import { CombatIcon, FeaturesIcon, MagicIcon, ProfileIcon, ResourcesIcon } from "../play/icons";

const ICONS: Record<SheetGroup, () => preact.JSX.Element> = {
  profile: ProfileIcon,
  combat: CombatIcon,
  magic: MagicIcon,
  bag: ResourcesIcon,
  features: FeaturesIcon,
};

/** The numbers needed most, in one row: armor class, initiative, speed, hit points, hit dice. */
function Summary() {
  const s = sheet.value;
  if (!s) return null;
  const hitDice = Object.entries(s.hitPoints.hitDice)
    .map(([die, n]) => `${n}${die}`)
    .join("+");
  const items: [string, string][] = [
    [ui("play.ac"), String(s.armorClass.value)],
    [ui("play.init"), signed(s.initiative)],
    [ui("sheet.speed"), s.speed === undefined ? "—" : distance(s.speed)],
    [ui("play.hpShort"), String(s.hitPoints.max)],
    [ui("sheet.hitDice"), hitDice || "—"],
  ];
  return (
    <dl class="sheet-summary">
      {items.map(([label, value]) => (
        <div key={label}>
          <dd>{value}</dd>
          <dt>{label}</dt>
        </div>
      ))}
    </dl>
  );
}

/** On a phone: the key numbers and the tabs for the parts of the sheet, pinned under the top tabs. */
export function SheetTabs({ groups }: { groups: SheetGroup[] }) {
  const active = sheetGroup.value;
  return (
    <div class="sheet-sticky">
      <Summary />
      <div class="sheet-groups" role="tablist" aria-label={ui("sheet.groups")}>
        {SHEET_GROUPS.filter((g) => groups.includes(g)).map((g) => {
          const Picture = ICONS[g];
          return (
            <button
              type="button"
              role="tab"
              key={g}
              class={active === g ? "on" : ""}
              aria-selected={active === g}
              onClick={() => showSheetGroup(g)}
            >
              <Picture />
              <span>{ui(`sheet.group.${g}` as UiKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
