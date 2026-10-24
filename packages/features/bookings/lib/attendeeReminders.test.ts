import { describe, expect, it } from "vitest";

import { getAttendeeReminderOffsets, getDueAttendeeReminderOffsets } from "./attendeeReminders";

const HOUR = 60 * 60 * 1000;
const start = new Date("2026-11-02T15:00:00.000Z");
const at = (hoursBeforeStart: number) => new Date(start.getTime() - hoursBeforeStart * HOUR);

describe("getAttendeeReminderOffsets", () => {
  it("defaults to 24 h and 1 h when the event type has no setting", () => {
    expect(getAttendeeReminderOffsets(null)).toEqual([1440, 60]);
    expect(getAttendeeReminderOffsets({})).toEqual([1440, 60]);
  });

  it("returns nothing when reminders are turned off", () => {
    expect(getAttendeeReminderOffsets({ attendeeReminders: { enabled: false } })).toEqual([]);
  });

  it("uses custom offsets, dropping duplicates and values the cron can't reach", () => {
    expect(
      getAttendeeReminderOffsets({ attendeeReminders: { enabled: true, offsetsMinutes: [120, 120, 7, 10080] } })
    ).toEqual([120]);
  });
});

describe("getDueAttendeeReminderOffsets", () => {
  const base = { startTime: start, offsetsMinutes: [1440, 60], sentOffsetsMinutes: new Set<number>() };

  it("is due inside the window, even when the cron runs a few minutes late", () => {
    expect(getDueAttendeeReminderOffsets({ ...base, createdAt: at(72), now: at(23.9) })).toEqual([1440]);
  });

  it("is not due before the window opens", () => {
    expect(getDueAttendeeReminderOffsets({ ...base, createdAt: at(72), now: at(24.1) })).toEqual([]);
  });

  it("skips offsets that were already sent", () => {
    expect(
      getDueAttendeeReminderOffsets({
        ...base,
        createdAt: at(72),
        now: at(0.5),
        sentOffsetsMinutes: new Set([1440]),
      })
    ).toEqual([60]);
  });

  it("skips offsets whose send time was before the booking was made", () => {
    expect(getDueAttendeeReminderOffsets({ ...base, createdAt: at(2), now: at(0.9) })).toEqual([60]);
    expect(getDueAttendeeReminderOffsets({ ...base, createdAt: at(0.5), now: at(0.4) })).toEqual([]);
  });

  it("returns every missed offset after a long outage so they can all be recorded", () => {
    expect(getDueAttendeeReminderOffsets({ ...base, createdAt: at(72), now: at(0.5) })).toEqual([1440, 60]);
  });

  it("sends nothing once the booking has started", () => {
    expect(getDueAttendeeReminderOffsets({ ...base, createdAt: at(72), now: start })).toEqual([]);
  });
});
