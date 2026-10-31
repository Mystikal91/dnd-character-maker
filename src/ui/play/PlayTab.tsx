import type { ComponentChildren } from "preact";
import { useRef } from "preact/hooks";
import { levelUpPhase } from "../../app/buildState";
import { playStates, stateAttributes } from "../../app/playStates";
import { type PlayGroup, playGroup, showPlayGroup } from "../../app/playView";
import { character, content, sheet } from "../../app/store";
import { MAX_LEVEL } from "../../engine/levelUp";
import { ui } from "../../i18n/ui";
import { CoinsPanel } from "../Coins";
import { collectSpellRows } from "../spellRows";
import { neighbour, useSwipe } from "../useSwipe";
import { BeastStrip } from "./BeastStrip";
import { Companions } from "./Companions";
import { DiceButton, DiceDrawer } from "./DiceDrawer";
import { PlayFeatures } from "./Features";
import { PlayInventory } from "./Inventory";
import { Rage, RageStrip } from "./Rage";
import { ClassResources, Conditions, PlayNotes, PlaySpells, Slots } from "./Resources";
import { AttackRolls, CheckRolls, DiceTray, ModePicker, RollHistory } from "./Rolls";
import { GroupTabs, StatusBar } from "./StatusBar";
import { DeathSaves, HitDice, HitPoints, Rests } from "./Vitals";
import { WildShape } from "./WildShape";

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
  const root = useRef<HTMLDivElement>(null);
  const parts = useRef<{ groups: PlayGroup[]; open: PlayGroup }>({
    groups: [],
    open: "combat",
  });
  useSwipe(
    root,
    () => {
      const head = root.current?.querySelector(".play-head");
      return head ? getComputedStyle(head).display !== "none" : false;
    },
    (delta) => {
      const next = neighbour(parts.current.groups, parts.current.open, delta);
      if (next) showPlayGroup(next);
      return next !== undefined;
    },
  );
  if (!c || !s) return null;
  const canLevelUp = character.value.classes.length > 0 && s.level < MAX_LEVEL;
  const hasMagic = s.spellcasters.length > 0 || collectSpellRows(c, s).length > 0;
  const groups: PlayGroup[] = hasMagic
    ? ["combat", "checks", "magic", "resources"]
    : ["combat", "checks", "resources"];
  // A part that is not there (no magic) opens the first one.
  const open = groups.includes(playGroup.value) ? playGroup.value : "combat";
  parts.current = { groups, open };

  // What the character is going through colours the screen: an aura at its edges, and the cards.
  const states = stateAttributes(playStates(character.value.play, s.hitPoints.max));

  return (
    <>
      <div class="play-aura" aria-hidden="true" {...states} />
      <div
        class="play"
        data-group={open}
        data-form={character.value.play.wildShape ? "beast" : undefined}
        data-rage={character.value.play.raging ? "on" : undefined}
        {...states}
        ref={root}
      >
        <div class="play-head">
          <RageStrip />
          <BeastStrip />
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
        <RageStrip wide />
        <BeastStrip wide />
        <div class="play-grid">
          <div class="play-col">
            <Part group="combat" order={1}>
              <HitPoints />
            </Part>
            <Part group="combat" order={2}>
              <Rage />
              <WildShape />
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
            <Part group="resources" order={5}>
              <PlayInventory />
            </Part>
            <Part group="combat" order={4}>
              <Conditions />
            </Part>
            <Part group="combat" order={5}>
              <Companions />
            </Part>
            <Part group="resources" order={6}>
              <PlayFeatures />
            </Part>
            <Part group="resources" order={7}>
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
      </div>
    </>
  );
}
