import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { nextEditStrings, relinkEdits } from "./quickEdit.logic";

const base = (field: string) => ({ name: "Fireball", desc: "A bright streak." })[field];

describe("saving a quick edit", () => {
  it("keeps only what differs from the original", () => {
    const next = nextEditStrings(
      {},
      "srd51:spell/fireball",
      { name: "Palla di fuoco", desc: "A bright streak." },
      base,
    );
    expect(next).toEqual({ "srd51:spell/fireball.name": "Palla di fuoco" });
  });

  it("goes back to the original when a text is empty or the same again", () => {
    const current = {
      "srd51:spell/fireball.name": "Palla di fuoco",
      "srd51:spell/fireball.desc": "Una scia luminosa.",
      "other:spell/x.name": "Altro",
    };
    const next = nextEditStrings(
      current,
      "srd51:spell/fireball",
      { name: "  ", desc: "A bright streak." },
      base,
    );
    expect(next).toEqual({ "other:spell/x.name": "Altro" });
  });

  it("trims the text and adds a field that had no original", () => {
    const next = nextEditStrings(
      {},
      "a:b/c",
      { flavor: "  Un sapore\r\nnuovo  " },
      () => undefined,
    );
    expect(next).toEqual({ "a:b/c.flavor": "Un sapore\nnuovo" });
  });
});

describe("quick edits made when a pack had another id", () => {
  const entry = (id: string, kind: Entry["kind"]): [string, Entry] => [
    id,
    { id, kind, effects: [], data: {} } as Entry,
  ];
  // The ids of a real export: the edits were made on packs that were imported again since.
  const index = new Map<string, Entry>([
    entry("srd51:spell/fireball", "spell"),
    entry("impmvnix566:species/custom-lineage", "species"),
    entry("impmvnisgql:background/entertainer", "background"),
    entry("impmvnix566:feat/fey-touched", "feat"),
  ]);

  it("are put on the entry as it is called now", () => {
    const moved = relinkEdits(
      {
        "impmvmh7zf9:species/custom-lineage.name": "Lignaggio Personalizzato",
        "impmvmh7kq7:background/entertainer.name": "Intrattenitore",
        "impmvmh7zf9:feat/fey-touched.desc":
          "L’esposizione alla magia.\n\n- Aumenta il tuo punteggio.",
      },
      index,
    );
    expect(moved).toEqual({
      "impmvnix566:species/custom-lineage.name": "Lignaggio Personalizzato",
      "impmvnisgql:background/entertainer.name": "Intrattenitore",
      "impmvnix566:feat/fey-touched.desc":
        "L’esposizione alla magia.\n\n- Aumenta il tuo punteggio.",
    });
  });

  it("leave alone what still finds its entry, the SRD, and what cannot be told for certain", () => {
    const twice = new Map(index).set(...entry("impother:species/custom-lineage", "species"));
    expect(
      relinkEdits(
        {
          "srd51:spell/fireball.name": "Palla di fuoco",
          "impmvnix566:species/custom-lineage.name": "Già a posto",
          "impold:species/custom-lineage.name": "Due possibili",
          "impold:item/nothing-like-it.name": "Niente",
        },
        twice,
      ),
    ).toEqual({});
  });
});
