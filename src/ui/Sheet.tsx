import { content, sheet } from "../app/store";
import { SpellSheet } from "./SpellSheet";
import { AbilityBlocks, Badges } from "./sheet/AbilityBlocks";
import { ClassFeatures } from "./sheet/ClassFeatures";
import { Attacks, CoreStats } from "./sheet/CoreStats";
import { CustomFeaturesPanel } from "./sheet/CustomFeaturesPanel";
import { Defenses, Feats, Inventory, Notes, Proficiencies, SpeciesTraits } from "./sheet/Details";
import { SheetHeader } from "./sheet/SheetHeader";
import { SpellcastingPanel } from "./sheet/SpellcastingPanel";
import { StoryPanel } from "./sheet/Story";

/**
 * The character sheet on screen: three columns when there is room (abilities and skills,
 * combat and spells, features by level), two or one when there is not.
 */
export function Sheet() {
  if (!content.value || !sheet.value) return null;
  return (
    <div class="sheet">
      <SheetHeader />
      <div class="sheet-grid">
        <div class="sheet-col col-left">
          <Badges />
          <AbilityBlocks />
          <Proficiencies />
          <Defenses />
        </div>
        <div class="sheet-col col-center">
          <CoreStats />
          <Attacks />
          <SpellcastingPanel />
          <SpellSheet />
          <Inventory />
          <Notes />
        </div>
        <div class="sheet-col col-right">
          <StoryPanel />
          <SpeciesTraits />
          <Feats />
          <ClassFeatures />
          <CustomFeaturesPanel />
        </div>
      </div>
    </div>
  );
}
