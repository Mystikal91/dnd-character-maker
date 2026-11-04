import { afterEach, describe, expect, it, vi } from "vitest";
import { uuid } from "./uuid";

const SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuid", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("makes a version 4 identifier", () => {
    expect(uuid()).toMatch(SHAPE);
  });

  it("still works where crypto.randomUUID is missing (a page over plain HTTP)", () => {
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const a = uuid();
    expect(a).toMatch(SHAPE);
    expect(uuid()).not.toBe(a);
  });
});
