import type { ComponentChildren } from "preact";
import { levelUpPhase } from "../../app/buildState";
import { rollLog } from "../../app/play";
import { type PlayGroup, playGroup } from "../../app/playView";
import { character, content, sheet } from "../../app/store";
import { MAX_LEVEL } from "../../engine/levelUp";
import { ui } from "../../i18n/ui";
import { CoinsPanel } from "../Coins";
import { collectSpellRows } from "../spellRows";
import { DiceButton, DiceDrawer } from "./DiceDrawer";
import { ClassResources, Conditions, PlayNotes, PlaySpells, Slots } from "./Resources";
import { AttackRolls, CheckRolls, DiceTray, ModePicker, RollHistory } from "./Rolls";
import { GroupTabs, StatusBar } from "./StatusBar";
import { DeathSaves, HitDice, HitPoints, Rests } from "./Vitals";

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
 * A panel and the part of the screen it belongs to. On a phone only the part that is open is
 * shown and `order` says where each panel sits in it; on a wide screen every part is shown.
 */
const Part = ({
  group,
  order,
  wide,
  children,
}: {
  group: PlayGroup;
  order: number;
  /** Only on a wide screen: on a phone it lives elsewhere (the dice drawer). */
  wide?: boolean;
  children: ComponentChildren;
}) => (
  <div class={`pg${wide ? " wide-only" : ""}`} data-g={group} style={{ "--o": order }}>
    {children}
  </div>
);

/**
 * The screen for the table. On a wide screen: hit points and rests on the left, rolls in the
 * middle, spell slots and conditions on the right. On a phone it is split into parts (combat,
 * checks, magic, resources) behind tabs, under a bar that always shows hit points and armor class.
 */
export function PlayTab() {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s) return null;
  const canLevelUp = character.value.classes.length > 0 && s.level < MAX_LEVEL;
  const hasMagic = s.spellcasters.length > 0 || collectSpellRows(c, s).length > 0;
  const groups: PlayGroup[] = hasMagic
    ? ["combat", "checks", "magic", "resources"]
    : ["combat", "checks", "resources"];
  // A part that is not there (no magic) opens the first one.
  const open = groups.includes(playGroup.value) ? playGroup.value : "combat";

  return (
    <div class="play" data-group={open}>
      <div class="play-head">
        <StatusBar />
        <GroupTabs groups={groups} />
        {(open === "combat" || open === "checks") && (
          <div class="head-mode">
            <ModePicker />
          </div>
        )}
      </div>
      {canLevelUp && (
        <button
          type="button"
          class="level-up-button play-levelup"
          onClick={() => {
            levelUpPhase.value = "choose";
          }}
        >
          <span aria-hidden="true">{"✦ "}</span>
          {ui("levelUp.button")}
        </button>
      )}
      <div class="play-grid">
        <div class="play-col">
          <Part group="combat" order={1}>
            <HitPoints />
          </Part>
          <Part group="combat" order={3}>
            <DeathSaves />
          </Part>
          <Part group="resources" order={2}>
            <HitDice />
          </Part>
          <Part group="resources" order={3}>
            <Rests />
          </Part>
          <Part group="resources" order={1}>
            <ClassResources />
          </Part>
          <Part group="resources" order={4}>
            <CoinsPanel />
          </Part>
          <Part group="combat" order={4}>
            <Conditions />
          </Part>
          <Part group="resources" order={5}>
            <PlayNotes />
          </Part>
        </div>
        <div class="play-col">
          <Part group="combat" order={2}>
            <AttackRolls />
          </Part>
          <Part group="checks" order={1}>
            <CheckRolls />
          </Part>
        </div>
        <div class="play-col">
          <Part group="checks" order={2} wide>
            <DiceTray />
          </Part>
          <Part group="checks" order={3} wide>
            <RollHistory />
          </Part>
          <Part group="magic" order={1}>
            <Slots />
          </Part>
          <Part group="magic" order={2}>
            <PlaySpells />
          </Part>
        </div>
      </div>
      <DiceButton />
      <DiceDrawer />
      <LatestRoll />
    </div>
  );
}
