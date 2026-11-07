// @vitest-environment happy-dom
import { h, render } from "preact";
import { describe, expect, it } from "vitest";
import { character, content, sheet } from "../../app/store";
import { loadContent } from "../../content/browser";
import { CLASSES, build, complete } from "../../test/characters";
import { PrepareSpellsDialog, prepareAsked, preparingCasters } from "./PrepareSpells";
import { PlaySpells } from "./SpellList";

const PREPARING = ["cleric", "druid", "paladin", "wizard"];

async function drawn(component: () => unknown): Promise<{ host: HTMLElement; done: () => void }> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  render(h(component as never, {}), host);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return {
    host,
    done: () => {
      render(null, host);
      host.remove();
    },
  };
}

describe("changing the prepared spells", () => {
  it("is offered to the classes that prepare their spells, and only to them", async () => {
    content.value = await loadContent(["en"]);
    for (const cls of CLASSES.filter(
      (c) => c !== "fighter" && c !== "barbarian" && c !== "monk" && c !== "rogue",
    )) {
      character.value = complete(build(cls, 5, "human"));
      const { host, done } = await drawn(PlaySpells);
      const offered = host.textContent?.includes("Change prepared spells") ?? false;
      done();
      expect(offered, cls).toBe(PREPARING.includes(cls));
      expect(preparingCasters(sheet.value).length > 0, cls).toBe(PREPARING.includes(cls));
    }
  });

  it("changes what is prepared, within the number the class may hold", async () => {
    content.value = await loadContent(["en"]);
    character.value = complete(build("cleric", 5, "human"));
    const { host, done } = await drawn(PrepareSpellsDialog);
    prepareAsked.value = "button";
    await new Promise((resolve) => setTimeout(resolve, 0));
    const boxes = [...host.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
    expect(boxes.length).toBeGreaterThan(0);
    const caster = preparingCasters(sheet.value)[0];
    const allowed = caster?.lists.prepared?.allowed ?? 0;
    expect(allowed).toBeGreaterThan(0);
    // Everything that is ticked is at most what the class may prepare; the rest are blocked.
    const ticked = boxes.filter((b) => b.checked).length;
    expect(ticked).toBeLessThanOrEqual(allowed);
    if (ticked === allowed) expect(boxes.some((b) => !b.checked && b.disabled)).toBe(true);
    // Un-preparing one frees a place, which another spell can then take.
    const on = boxes.find((b) => b.checked);
    on?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const after = preparingCasters(sheet.value)[0]?.lists.prepared?.chosen.length ?? 0;
    expect(after).toBe(ticked - 1);
    const free = [...host.querySelectorAll<HTMLInputElement>("input[type=checkbox]")].find(
      (b) => !b.checked && !b.disabled,
    );
    free?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(preparingCasters(sheet.value)[0]?.lists.prepared?.chosen.length).toBe(ticked);
    prepareAsked.value = undefined;
    done();
  });
});
