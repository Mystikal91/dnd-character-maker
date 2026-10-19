import { rollLog } from "../../app/play";
import { content, sheet } from "../../app/store";
import { ui } from "../../i18n/ui";
import { ClassResources, Conditions, PlaySpells, Slots } from "./Resources";
import { DiceTray, QuickRolls, RollHistory } from "./Rolls";
import { Vitals } from "./Vitals";

/** The last roll, pinned to the bottom of the screen so it is seen while tapping buttons. */
function LatestRoll() {
  const latest = rollLog.value[0];
  if (!latest) return null;
  return (
    <output class={`latest-roll ${latest.tone ?? ""}`.trim()} key={latest.id}>
      <span class="latest-label">{latest.label}</span>
      {latest.detail && <span class="latest-detail">{latest.detail}</span>}
      {latest.total !== undefined && <b class="latest-total">{latest.total}</b>}
      {latest.tone && (
        <em>{latest.tone === "critical" ? ui("play.critical") : ui("play.fumble")}</em>
      )}
    </output>
  );
}

/**
 * The screen for the table: hit points and rests on the left, rolls in the middle, spell
 * slots and conditions on the right. It reflows to two or one column on narrower screens.
 */
export function PlayTab() {
  if (!content.value || !sheet.value) return null;
  return (
    <div class="play">
      <div class="play-grid">
        <div class="play-col">
          <Vitals />
          <ClassResources />
          <Conditions />
        </div>
        <div class="play-col">
          <QuickRolls />
        </div>
        <div class="play-col">
          <DiceTray />
          <RollHistory />
          <Slots />
          <PlaySpells />
        </div>
      </div>
      <LatestRoll />
    </div>
  );
}
