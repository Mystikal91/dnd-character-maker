import type { ComponentChildren } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { levelUpPhase } from "../../app/buildState";
import { playStates, stateAttributes } from "../../app/playStates";
import { type PlayGroup, playGroup, showPlayGroup } from "../../app/playView";
import { character, content, sheet } from "../../app/store";
import { ACTIVATIONS, characterActions } from "../../engine/actions";
import { MAX_LEVEL } from "../../engine/levelUp";
import { visibleSlots } from "../../engine/slots";
import { ui } from "../../i18n/ui";
import { CoinsPanel } from "../Coins";
import { collectSpellRows } from "../spellRows";
import { neighbour, useSwipe } from "../useSwipe";
import { ActionsPanel } from "./Actions";
import { BeastStrip } from "./BeastStrip";
import { Companions } from "./Companions";
import { Conditions } from "./Conditions";
import { DiceButton, DiceDrawer } from "./DiceDrawer";
import { PlayFeatures, shownFeatures } from "./Features";
import { BardNotes, Inspiration } from "./Inspiration";
import { PlayInventory } from "./Inventory";
import { Rage, RageStrip } from "./Rage";
import { ClassResources, PlayNotes, Slots } from "./Resources";
import { Rests } from "./Rests";
import { AttackRolls, CheckRolls, DiceTray, ModePicker, RollHistory } from "./Rolls";
import { PlaySpells } from "./SpellList";
import { GroupTabs, StatusBar } from "./StatusBar";
import { DeathSaves, HitDice, HitPoints } from "./Vitals";
import { WildShape } from "./WildShape";
import { type LayoutFacts, estimateHeights, planColumns } from "./columns";

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

type PanelKey =
  | "hp"
  | "rage"
  | "inspiration"
  | "death"
  | "hitdice"
  | "rests"
  | "classres"
  | "coins"
  | "inventory"
  | "conditions"
  | "companions"
  | "features"
  | "notes"
  | "attacks"
  | "actions"
  | "checks"
  | "dice"
  | "history"
  | "slots"
  | "spells";

interface PanelDef {
  group: PlayGroup;
  order: number;
  wide?: boolean;
  render: () => ComponentChildren;
}

/**
 * Every panel of the screen, with the part of the phone it belongs to and where it sits in it. The
 * keys are in the order a phone shows them when two panels have the same place.
 */
const PANELS: Record<PanelKey, PanelDef> = {
  hp: { group: "combat", order: 1, render: () => <HitPoints /> },
  rage: {
    group: "combat",
    order: 4,
    render: () => (
      <>
        <Rage />
        <WildShape />
      </>
    ),
  },
  inspiration: { group: "combat", order: 5, render: () => <Inspiration /> },
  death: { group: "combat", order: 2, render: () => <DeathSaves /> },
  hitdice: { group: "resources", order: 2, render: () => <HitDice /> },
  rests: { group: "resources", order: 3, render: () => <Rests /> },
  classres: { group: "resources", order: 1, render: () => <ClassResources /> },
  coins: { group: "resources", order: 5, render: () => <CoinsPanel /> },
  inventory: { group: "resources", order: 4, render: () => <PlayInventory /> },
  conditions: { group: "combat", order: 3, render: () => <Conditions /> },
  companions: { group: "combat", order: 8, render: () => <Companions /> },
  features: { group: "resources", order: 6, render: () => <PlayFeatures /> },
  notes: { group: "resources", order: 7, render: () => <PlayNotes /> },
  attacks: { group: "combat", order: 6, render: () => <AttackRolls /> },
  actions: { group: "combat", order: 7, render: () => <ActionsPanel /> },
  checks: { group: "checks", order: 1, render: () => <CheckRolls /> },
  dice: { group: "checks", order: 2, wide: true, render: () => <DiceTray /> },
  history: { group: "checks", order: 3, wide: true, render: () => <RollHistory /> },
  slots: { group: "magic", order: 1, render: () => <Slots /> },
  spells: { group: "magic", order: 2, render: () => <PlaySpells /> },
};

/** What the character has, for the estimate of how tall each panel is (see `columns.ts`). */
function layoutFacts(
  c: NonNullable<typeof content.value>,
  s: NonNullable<typeof sheet.value>,
): LayoutFacts {
  const inventory = character.value.inventory;
  const actions = characterActions(s, c.index);
  const shown = shownFeatures(c, s);
  return {
    attacks: s.attacks.length,
    extraDamage: s.extraDamage.length,
    actionCards: ACTIVATIONS.reduce((n, a) => n + actions[a].length, 0),
    actionGroups: ACTIVATIONS.filter((a) => actions[a].length > 0).length,
    hitDiceKinds: Object.keys(s.hitPoints.hitDice).length,
    resources: s.resources.length + s.facts.length,
    features: shown.class.length + shown.species.length + shown.feat.length,
    companions: character.value.companions?.length ?? 0,
    tiles: visibleSlots(inventory, c.index).length,
    pack: inventory.filter((i) => !i.equipped).length,
    spells: collectSpellRows(c, s).length,
    rage: s.extraDamage.some((x) => x.kind === "rage"),
    wildShape: s.facts.some((f) => f.kind === "wildShape"),
    bardic: s.facts.some((f) => f.kind === "bardicDie"),
  };
}

/** How many columns the play screen has room for: the same breakpoints as the styles (42 and 66rem). */
const columnsFor = (rem: number): 1 | 2 | 3 => (rem >= 66 ? 3 : rem >= 42 ? 2 : 1);

/** Follows the width of the screen and says how many columns it has room for. */
function useColumns(root: { current: HTMLElement | null }, ready: boolean): 1 | 2 | 3 {
  const [columns, setColumns] = useState<1 | 2 | 3>(() =>
    columnsFor(typeof innerWidth === "number" ? innerWidth / 16 : 0),
  );
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || !ready) return;
    const measure = () => {
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setColumns(columnsFor(el.getBoundingClientRect().width / rem));
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [root, ready]);
  return columns;
}

/**
 * The screen for the table. On a wide screen the panels are in two or three columns of about the
 * same height (see `columns.ts`). On a phone it is split into parts (combat, checks, magic,
 * resources) behind tabs, under a bar that always shows hit points and armor class.
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
  const columns = useColumns(root, Boolean(c && s));
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
      <div class="play-aura" aria-hidden="true" {...states}>
        {states["data-bardic"] && <BardNotes />}
      </div>
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
        <div class="play-grid" data-cols={columns}>
          {planColumns(
            columns,
            estimateHeights(layoutFacts(c, s)),
            (key) => hasMagic || PANELS[key as PanelKey]?.group !== "magic",
          ).map((keys) => (
            <div class="play-col" key={keys.join("-")}>
              {keys.map((key) => {
                const panel = PANELS[key as PanelKey];
                return (
                  <Part key={key} group={panel.group} order={panel.order} wide={panel.wide}>
                    {panel.render()}
                  </Part>
                );
              })}
            </div>
          ))}
        </div>
        <DiceButton />
        <DiceDrawer />
      </div>
    </>
  );
}
