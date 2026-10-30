/**
 * The two ways to take the free ability increase of an origin, as Aurora writes them in its
 * internal file. A set of files that has no such file (the supplements, imported on their own,
 * after the core) still needs them: the species of its books offer the choice by naming them.
 */
export const ASI_OPTIONS_XML = `<elements>
  <element name="Ability Score Improvement +2, +1" type="Ability Score Improvement" source="Internal" id="ID_WOTC_ASI_ABILITY_SCORE_IMPROVEMENT_OPTION_1">
    <supports>Custom Ability Score Improvement Option</supports>
    <description>
      <p>You can increase one of the scores by 2 and increase a different score by 1.</p>
    </description>
    <sheet display="false" />
    <rules>
      <select type="Ability Score Improvement" name="Custom Ability Score Improvement +2" supports="Custom Ability Score Increase 2" />
      <select type="Ability Score Improvement" name="Custom Ability Score Improvement +1" supports="Custom Ability Score Increase 1" />
    </rules>
  </element>
  <element name="Ability Score Improvement +1, +1, +1" type="Ability Score Improvement" source="Internal" id="ID_WOTC_ASI_ABILITY_SCORE_IMPROVEMENT_OPTION_2">
    <supports>Custom Ability Score Improvement Option</supports>
    <description>
      <p>You can increase three different scores by 1.</p>
    </description>
    <sheet display="false" />
    <rules>
      <select type="Ability Score Improvement" name="Custom Ability Score Improvement +1" number="3" supports="Custom Ability Score Increase 1" />
    </rules>
  </element>
</elements>`;
