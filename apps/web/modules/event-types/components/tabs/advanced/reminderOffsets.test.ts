import { describe, expect, it } from "vitest";
import { getReminderLabelKey, splitReminderMinutes, toReminderMinutes } from "./reminderOffsets";

describe("reminderOffsets", () => {
  it.each([
    [1440, { amount: 1, unit: "days" }],
    [2880, { amount: 2, unit: "days" }],
    [120, { amount: 2, unit: "hours" }],
    [60, { amount: 1, unit: "hours" }],
    [90, { amount: 90, unit: "minutes" }],
    [1500, { amount: 25, unit: "hours" }],
  ])("splits %s minutes into the largest exact unit", (minutes, expected) => {
    expect(splitReminderMinutes(minutes)).toEqual(expected);
  });

  it("converts an amount and unit back to minutes", () => {
    expect(toReminderMinutes(2, "days")).toBe(2880);
    expect(toReminderMinutes(3, "hours")).toBe(180);
    expect(toReminderMinutes(45, "minutes")).toBe(45);
    expect(toReminderMinutes(1.5, "hours")).toBe(90);
  });

  it("builds the translation key per unit", () => {
    expect(getReminderLabelKey("hours")).toBe("reminder_hours_before");
  });
});
