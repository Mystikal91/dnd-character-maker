import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

const item = (slug: string, effects: Entry["effects"]): Entry => ({
  id: `test:item/${slug}`,
  kind: "item",
  effects,
  data: { category: "rings", cost: { amount: 0, unit: "gp" }, rarity: "rare" },
});

const items = [
  item("swim-20", [{ type: "movement", mode: "swim", feet: 20 }]),
  item("swim-40", [{ type: "movement", mode: "swim", feet: 40 }]),
  item("wings", [{ type: "movement", mode: "fly", feet: "walk" }]),
  item("burrow-10", [{ type: "movement", mode: "burrow", feet: 10 }]),
  item("boots", [{ type: "modifier", target: "speed", value: 10 }]),
  item("light-boots", [{ type: "modifier", target: "speed", value: 10, when: "noHeavyArmor" }]),
  item("goggles", [{ type: "sense", sense: "darkvision", range: 60 }]),
  item("better-goggles", [{ type: "sense", sense: "darkvision", range: 120 }]),
  item("sight", [{ type: "sense", sense: "blindsight", range: 10 }]),
  item("flier-in-light-armor", [{ type: "movement", mode: "fly", feet: 30, when: "noHeavyArmor" }]),
];
const index = new Map<string, Entry>([...srd51Index, ...items.map((e) => [e.id, e] as const)]);

function sheetOf(species: string, ...worn: string[]) {
  const c = createCharacter("srd51");
  c.choices.species = `srd51:species/${species}`;
  c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
  c.inventory = worn.map((slug) => ({ itemId: `test:item/${slug}`, quantity: 1, equipped: true }));
  return deriveSheet(c, index);
}

describe("speeds other than walking", () => {
  it("climbs and swims at half the walking speed, and does not fly or burrow", () => {
    const s = sheetOf("human");
    expect(s.speed).toBe(30);
    expect(s.movement).toEqual({
      climb: { feet: 15, half: true },
      swim: { feet: 15, half: true },
    });
  });

  it("follows a bonus to the speed: the half, and the speeds that were given", () => {
    const s = sheetOf("human", "boots", "swim-40", "burrow-10");
    expect(s.speed).toBe(40);
    expect(s.movement.climb).toEqual({ feet: 20, half: true });
    expect(s.movement.swim).toEqual({ feet: 50 });
    expect(s.movement.burrow).toEqual({ feet: 20 });
  });

  it("keeps the half when a given speed is slower than it", () => {
    expect(sheetOf("human", "swim-20").movement.swim).toEqual({ feet: 20 });
    const slow = sheetOf("dwarf", "swim-20");
    expect(slow.speed).toBe(25);
    expect(slow.movement.swim).toEqual({ feet: 20 });
    expect(sheetOf("dwarf").movement.swim).toEqual({ feet: 12, half: true });
  });

  it("gives a speed equal to the walking one, bonus included", () => {
    expect(sheetOf("human", "wings", "boots").movement.fly).toEqual({ feet: 40 });
  });

  it("takes a speed that needs no heavy armor only without it", () => {
    expect(sheetOf("human", "flier-in-light-armor").movement.fly).toEqual({ feet: 30 });
    const c = createCharacter("srd51");
    c.choices.species = "srd51:species/human";
    c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
    c.inventory = [
      { itemId: "test:item/flier-in-light-armor", quantity: 1, equipped: true },
      { itemId: "srd51:item/plate-armor", quantity: 1, equipped: true },
    ];
    expect(deriveSheet(c, index).movement.fly).toBeUndefined();
  });
});

describe("senses", () => {
  it("lists the range of each, the longest when two give the same", () => {
    expect(sheetOf("human").senses).toEqual({});
    expect(sheetOf("human", "goggles", "sight").senses).toEqual({
      darkvision: 60,
      blindsight: 10,
    });
    expect(sheetOf("human", "goggles", "better-goggles").senses.darkvision).toBe(120);
  });
});
