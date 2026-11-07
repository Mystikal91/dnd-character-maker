// @vitest-environment happy-dom
import { h, render } from "preact";
import { describe, expect, it } from "vitest";
import { character, content, updateCharacter } from "../../app/store";
import { loadContent } from "../../content/browser";
import { build, complete } from "../../test/characters";
import { FeaturesStep } from "../build/FeaturesStep";
import { ClassFeatures } from "./ClassFeatures";

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

describe("a feature that a better step replaces", () => {
  it("is off the class features of the sheet, and the step that replaces it says so", async () => {
    content.value = await loadContent(["en"]);
    character.value = complete(build("barbarian", 13, "human"));
    const { host, done } = await drawn(ClassFeatures);
    const titles = [...host.querySelectorAll("summary")].map((s) => s.textContent ?? "");
    expect(titles.some((t) => t.startsWith("Brutal Critical (1 die)"))).toBe(false);
    expect(titles.some((t) => t.startsWith("Brutal Critical (2 dice)"))).toBe(true);
    expect(host.textContent).toContain("Replaces: Brutal Critical (1 die)");
    done();
  });

  it("is hidden in the features step with its reason, and can be shown again", async () => {
    content.value = await loadContent(["en"]);
    character.value = complete(build("barbarian", 13, "human"));
    const first = await drawn(FeaturesStep);
    const row = [...first.host.querySelectorAll("details.feature-row")].find((r) =>
      r.textContent?.includes("Brutal Critical (1 die)"),
    );
    expect(row?.textContent).toContain("replaced by Brutal Critical (2 dice)");
    const box = row?.querySelector<HTMLInputElement>("input[type=checkbox]");
    expect(box?.checked).toBe(true);
    box?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(character.value.featureSettings?.["srd51:feature/brutal-critical-1-die"]).toEqual({
      hidden: false,
    });
    first.done();
    const shown = await drawn(ClassFeatures);
    const titles = [...shown.host.querySelectorAll("summary")].map((s) => s.textContent ?? "");
    expect(titles.some((t) => t.startsWith("Brutal Critical (1 die)"))).toBe(true);
    expect(shown.host.textContent).toContain(
      "Replaced by: Brutal Critical (2 dice)".replace(": ", " "),
    );
    shown.done();
    updateCharacter((d) => {
      d.featureSettings = undefined;
    });
  });
});
