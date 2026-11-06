import { describe, expect, it } from "vitest";
import {
  type InstallFacts,
  LATER_DAYS,
  canInstall,
  isIos,
  laterFrom,
  shouldInvite,
} from "./install.logic";

const base: InstallFacts = {
  installed: false,
  never: false,
  laterUntil: 0,
  now: 1_000_000,
  canPrompt: true,
  ios: false,
};

describe("when the invitation to install shows", () => {
  it("shows when the browser can prompt and nothing was said", () => {
    expect(shouldInvite(base)).toBe(true);
  });

  it("shows on an iPhone, where there is no prompt but there are steps", () => {
    expect(shouldInvite({ ...base, canPrompt: false, ios: true })).toBe(true);
  });

  it("does not show when there is no way to install, or the app is installed", () => {
    expect(shouldInvite({ ...base, canPrompt: false })).toBe(false);
    expect(shouldInvite({ ...base, installed: true })).toBe(false);
    expect(canInstall({ installed: true, canPrompt: true, ios: true })).toBe(false);
  });

  it("stays away after No", () => {
    expect(shouldInvite({ ...base, never: true })).toBe(false);
    // The menu still offers it: installable does not look at No.
    expect(canInstall({ installed: false, canPrompt: true, ios: false })).toBe(true);
  });

  it("stays away for a week after Later, and returns after it", () => {
    const until = laterFrom(base.now);
    expect(until - base.now).toBe(LATER_DAYS * 24 * 60 * 60 * 1000);
    expect(shouldInvite({ ...base, laterUntil: until })).toBe(false);
    expect(shouldInvite({ ...base, laterUntil: until, now: until - 1 })).toBe(false);
    expect(shouldInvite({ ...base, laterUntil: until, now: until })).toBe(true);
  });
});

describe("telling an iPhone or iPad", () => {
  it("knows the phone, the tablet and the tablet that says it is a Mac", () => {
    expect(isIos("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "iPhone", 5)).toBe(true);
    expect(isIos("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)", "iPad", 5)).toBe(true);
    expect(isIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5)).toBe(true);
  });

  it("is not a computer or an Android phone", () => {
    expect(isIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0)).toBe(false);
    expect(isIos("Mozilla/5.0 (Linux; Android 14; Pixel 8)", "Linux armv8l", 5)).toBe(false);
    expect(isIos("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Win32", 0)).toBe(false);
  });
});
