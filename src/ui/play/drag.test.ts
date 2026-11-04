import { describe, expect, it } from "vitest";
import { type Slot, dropIndex, nearestColumn } from "./drag";

const slot = (top: number, bottom: number, shown = true): Slot => ({ top, bottom, shown });

describe("where a dragged panel lands", () => {
  const column = [slot(0, 100), slot(110, 210), slot(220, 320)];

  it("goes before the first panel whose middle is below the pointer", () => {
    expect(dropIndex(column, 10)).toBe(0);
    expect(dropIndex(column, 60)).toBe(1);
    expect(dropIndex(column, 170)).toBe(2);
  });

  it("goes at the end when the pointer is below every panel", () => {
    expect(dropIndex(column, 900)).toBe(3);
  });

  it("is the first place of an empty column", () => {
    expect(dropIndex([], 50)).toBe(0);
  });

  it("counts the panels that are not on screen (a phone shows one part) but lands by those that are", () => {
    const phone = [slot(0, 0, false), slot(0, 100), slot(0, 0, false), slot(110, 210)];
    expect(dropIndex(phone, 20)).toBe(1);
    expect(dropIndex(phone, 150)).toBe(3);
    // After the last one on screen, not after the panels of other parts that follow it.
    expect(dropIndex([...phone, slot(0, 0, false)], 900)).toBe(4);
  });
});

describe("which column is under the pointer", () => {
  const columns = [
    { left: 0, right: 100 },
    { left: 110, right: 210 },
    { left: 220, right: 320 },
  ];

  it("is the one that holds the pointer, or the nearest, gaps and sides included", () => {
    expect(nearestColumn(columns, 50)).toBe(0);
    expect(nearestColumn(columns, 105)).toBe(0);
    expect(nearestColumn(columns, 108)).toBe(1);
    expect(nearestColumn(columns, 260)).toBe(2);
    expect(nearestColumn(columns, -40)).toBe(0);
    expect(nearestColumn(columns, 900)).toBe(2);
  });
});
