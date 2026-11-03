import { describe, expect, it } from "vitest";
import { srd51Index } from "../../test/srd51";
import pairs from "./srdPairs.json";

const table = pairs as Record<string, string[]>;

describe("the pairs of Aurora's Player's Handbook and the SRD", () => {
  it("points only at entries the app has", () => {
    const missing = Object.values(table)
      .flat()
      .filter((id) => !srd51Index.has(id));
    expect(missing).toEqual([]);
  });

  it("gives each feature of a class to one element only", () => {
    // A trait the species share (Fey Ancestry of the elf and of the half-elf) has an element in each.
    const owners = new Map<string, string>();
    const twice: string[] = [];
    for (const [aid, ids] of Object.entries(table))
      for (const id of ids.filter((i) => i.startsWith("srd51:feature/"))) {
        if (owners.has(id)) twice.push(`${id}: ${owners.get(id)} and ${aid}`);
        owners.set(id, aid);
      }
    expect(twice).toEqual([]);
  });

  it("keeps a feature in its own class", () => {
    // An element and the entries it stands for are in one class: a pair is never across classes.
    const classOf = (id: string) => {
      const data = srd51Index.get(id)?.data as { class?: string } | undefined;
      return data?.class;
    };
    const across = Object.entries(table).filter(([, ids]) => {
      const classes = new Set(ids.map(classOf).filter(Boolean));
      return classes.size > 1;
    });
    // Fighting styles are one element of the fighter that the paladin and the ranger share.
    const allowed = (aid: string) => /FIGHTING_?STYLE/i.test(aid);
    expect(across.filter(([aid]) => !allowed(aid)).map(([aid]) => aid)).toEqual([]);
  });

  it("has the features that spend a shared pool", () => {
    const found = (id: string) => Object.values(table).some((ids) => ids.includes(id));
    for (const id of [
      "srd51:feature/flurry-of-blows",
      "srd51:feature/patient-defense",
      "srd51:feature/step-of-the-wind",
      "srd51:feature/stunning-strike",
      "srd51:feature/channel-divinity-turn-undead",
      "srd51:trait/breath-weapon",
    ])
      expect(found(id), id).toBe(true);
  });
});
