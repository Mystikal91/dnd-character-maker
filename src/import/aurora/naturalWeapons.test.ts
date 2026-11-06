import { describe, expect, it } from "vitest";
import { NATURAL_WEAPONS, naturalWeaponEffects } from "./naturalWeapons";

describe("the table of natural weapons", () => {
  it("has a die and a kind of damage that make sense on every line", () => {
    for (const [aid, weapon] of Object.entries(NATURAL_WEAPONS)) {
      expect(aid, aid).toMatch(/^ID_WOTC_[A-Z0-9]+_RACIAL_TRAIT_/);
      expect(weapon.dice, aid).toMatch(/^1d(4|6|8)$/);
      expect(["bludgeoning", "piercing", "slashing"], aid).toContain(weapon.damageType);
    }
  });

  it("keeps the two printings of the Tabaxi apart", () => {
    expect(NATURAL_WEAPONS.ID_WOTC_VGTM_RACIAL_TRAIT_TAXBAXI_CATS_CLAWS?.dice).toBe("1d4");
    expect(NATURAL_WEAPONS.ID_WOTC_MOTM_RACIAL_TRAIT_TABAXI_CATS_CLAWS?.dice).toBe("1d6");
  });

  it("gives an effect only for the ids it knows", () => {
    expect(naturalWeaponEffects("ID_WOTC_MOTM_RACIAL_TRAIT_TORTLE_CLAWS")).toEqual([
      { type: "unarmedStrike", dice: "1d6", damageType: "slashing" },
    ]);
    expect(naturalWeaponEffects("ID_SOMETHING_ELSE")).toEqual([]);
  });
});
