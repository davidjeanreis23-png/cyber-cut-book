import { describe, it, expect } from "vitest";
import { timeStringToMinutes } from "./booking-time";

describe("timeStringToMinutes", () => {
  it("parses HH:mm", () => {
    expect(timeStringToMinutes("08:00")).toBe(8 * 60);
    expect(timeStringToMinutes("20:30")).toBe(20 * 60 + 30);
  });

  it("parses HH:mm:ss without using fractional seconds as minutes", () => {
    expect(timeStringToMinutes("09:00:00")).toBe(9 * 60);
    expect(timeStringToMinutes("14:15:59")).toBe(14 * 60 + 15);
  });

  it("returns 0 for empty string", () => {
    expect(timeStringToMinutes("")).toBe(0);
  });
});

describe("booking slot window (regression: invalid window yields no slots)", () => {
  it("detects open >= close so UI would show no slots", () => {
    const open = timeStringToMinutes("18:00");
    const close = timeStringToMinutes("09:00");
    expect(open >= close).toBe(true);
  });

  it("valid day window produces interval steps", () => {
    const open = timeStringToMinutes("08:00");
    const close = timeStringToMinutes("10:00");
    const interval = 30;
    const slots: string[] = [];
    let mins = open;
    while (mins < close) {
      const h = String(Math.floor(mins / 60)).padStart(2, "0");
      const m = String(mins % 60).padStart(2, "0");
      slots.push(`${h}:${m}`);
      mins += interval;
    }
    expect(slots).toEqual(["08:00", "08:30", "09:00", "09:30"]);
  });
});
