// @vitest-environment happy-dom
import { h, render } from "preact";
import { describe, expect, it } from "vitest";
import { character, content } from "../app/store";
import { loadContent } from "../content/browser";
import { CLASSES, build, complete } from "../test/characters";
import { Sheet } from "./Sheet";
import { BuildTab } from "./build/BuildTab";
import { PlayTab } from "./play/PlayTab";
import { PrintView } from "./print/PrintView";

const SCREENS = { sheet: Sheet, play: PlayTab, print: PrintView, build: BuildTab };

/** Draws a screen and returns what it showed, or the error it raised. */
async function draw(screen: keyof typeof SCREENS): Promise<{ text: string; error?: string }> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const failures: string[] = [];
  const onError = (event: ErrorEvent) => failures.push(String(event.error ?? event.message));
  window.addEventListener("error", onError);
  try {
    render(h(SCREENS[screen], {}), host);
    // Effects and measurements run after the first paint.
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { text: host.textContent ?? "", ...(failures[0] && { error: failures[0] }) };
  } catch (error) {
    return { text: "", error: String(error) };
  } finally {
    render(null, host);
    host.remove();
    window.removeEventListener("error", onError);
  }
}

describe("the screens draw for every class", () => {
  for (const locales of [["en"], ["it", "en"]]) {
    it(`without errors (${locales[0]})`, async () => {
      content.value = await loadContent(locales);
      const problems: string[] = [];
      for (const cls of CLASSES) {
        for (const level of [1, 5, 11, 20]) {
          character.value = complete(build(cls, level, "human"));
          for (const screen of Object.keys(SCREENS) as (keyof typeof SCREENS)[]) {
            const { text, error } = await draw(screen);
            if (error) problems.push(`${cls} ${level} ${screen}: ${error}`);
            else if (text.trim().length < 20) problems.push(`${cls} ${level} ${screen}: empty`);
          }
        }
      }
      expect(problems).toEqual([]);
    }, 120000);
  }
});

describe("sharing", () => {
  it("round-trips every class through a link, and fits a QR code at the usual size", async () => {
    const { encodeShare, decodeShare, QR_MAX_BYTES } = await import("../storage/share");
    const { parseCharacter } = await import("../engine/characterSchema");
    const tooBig: string[] = [];
    for (const cls of CLASSES) {
      for (const level of [1, 11, 20]) {
        const original = complete(build(cls, level, "elf"));
        const hash = await encodeShare(original);
        const back = await decodeShare(hash);
        const { id: _id, ...rest } = parseCharacter(JSON.parse(JSON.stringify(original)));
        expect({ ...back, id: "" }).toEqual({ ...rest, id: "" });
        if (hash.length > QR_MAX_BYTES) tooBig.push(`${cls} ${level}: ${hash.length}`);
      }
    }
    expect(tooBig).toEqual([]);
  });
});
