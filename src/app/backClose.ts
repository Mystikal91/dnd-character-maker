/**
 * The back button of a phone closes the dialog or sheet that is open instead of leaving the app.
 *
 * Every open `<dialog>` gets an entry in the history, so "back" goes to the page it was opened
 * from; the entry is taken away again when the dialog is closed any other way. Dialogs close
 * with the same call whoever asks (a button, Escape, back), so the screens need to know nothing.
 */
const KEY = "dialogEntry";

let started = false;
/** History entries added for the dialogs that are open now. */
let pushed = 0;
/** Pops of the history that this module asked for, so they are not taken for the back button. */
let ownPops = 0;
/** Open dialogs, the last one the newest. */
let stack: HTMLDialogElement[] = [];

function openDialogs(): HTMLDialogElement[] {
  const now = [...document.querySelectorAll<HTMLDialogElement>("dialog[open]")];
  stack = [...stack.filter((d) => now.includes(d)), ...now.filter((d) => !stack.includes(d))];
  return stack;
}

function sync() {
  const open = openDialogs().length;
  while (pushed < open) {
    history.pushState({ [KEY]: true }, "");
    pushed += 1;
  }
  if (pushed > open) {
    const extra = pushed - open;
    pushed = open;
    ownPops += 1;
    history.go(-extra);
  }
}

export function startBackClose() {
  if (started || typeof document === "undefined") return;
  started = true;
  const watch = new MutationObserver(sync);
  watch.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["open"],
  });
  addEventListener("popstate", () => {
    if (ownPops > 0) {
      ownPops -= 1;
      return;
    }
    const top = openDialogs().at(-1);
    if (!top) return;
    // The entry is gone already: the dialog closing must not remove another.
    pushed = Math.max(0, pushed - 1);
    top.close();
  });
}
