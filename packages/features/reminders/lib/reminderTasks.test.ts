import { describe, expect, it } from "vitest";
import { buildReminderTasks, getReminderReferenceUidPrefix } from "./reminderTasks";

const booking = {
  uid: "booking-uid",
  startTime: new Date("2026-11-02T15:00:00.000Z"),
  attendees: [{ id: 1 }, { id: 2 }],
};

describe("buildReminderTasks", () => {
  it("creates one task per rule and attendee, timed before the start", () => {
    const tasks = buildReminderTasks({
      booking,
      rules: [
        { channel: "EMAIL", minutesBefore: 1440 },
        { channel: "EMAIL", minutesBefore: 120 },
      ],
      now: new Date("2026-10-20T00:00:00.000Z"),
    });

    expect(tasks).toHaveLength(4);
    expect(tasks[0]).toEqual({
      referenceUid: "reminder:booking-uid:1:EMAIL:1440",
      scheduledAt: new Date("2026-11-01T15:00:00.000Z"),
      payload: {
        bookingUid: "booking-uid",
        attendeeId: 1,
        channel: "EMAIL",
        minutesBefore: 1440,
        startTime: "2026-11-02T15:00:00.000Z",
      },
    });
    expect(tasks.map((task) => task.scheduledAt.toISOString())).toEqual([
      "2026-11-01T15:00:00.000Z",
      "2026-11-01T15:00:00.000Z",
      "2026-11-02T13:00:00.000Z",
      "2026-11-02T13:00:00.000Z",
    ]);
  });

  it("keeps the exact offset across a DST change (US fall back on 2026-11-01)", () => {
    const [task] = buildReminderTasks({
      booking: { ...booking, attendees: [{ id: 1 }] },
      rules: [{ channel: "EMAIL", minutesBefore: 1440 }],
      now: new Date("2026-10-20T00:00:00.000Z"),
    });

    expect(booking.startTime.getTime() - task.scheduledAt.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("drops reminders whose time has already passed", () => {
    const tasks = buildReminderTasks({
      booking,
      rules: [
        { channel: "EMAIL", minutesBefore: 1440 },
        { channel: "EMAIL", minutesBefore: 120 },
      ],
      now: new Date("2026-11-02T10:00:00.000Z"),
    });

    expect(tasks.map((task) => task.payload.minutesBefore)).toEqual([120, 120]);
  });

  it("drops a reminder due exactly now", () => {
    const tasks = buildReminderTasks({
      booking,
      rules: [{ channel: "EMAIL", minutesBefore: 120 }],
      now: new Date("2026-11-02T13:00:00.000Z"),
    });

    expect(tasks).toEqual([]);
  });

  it("returns nothing without rules or attendees", () => {
    const now = new Date("2026-10-20T00:00:00.000Z");
    expect(buildReminderTasks({ booking, rules: [], now })).toEqual([]);
    expect(
      buildReminderTasks({
        booking: { ...booking, attendees: [] },
        rules: [{ channel: "EMAIL", minutesBefore: 60 }],
        now,
      })
    ).toEqual([]);
  });

  it("builds reference uids under the booking prefix", () => {
    const tasks = buildReminderTasks({
      booking,
      rules: [{ channel: "EMAIL", minutesBefore: 60 }],
      now: new Date("2026-10-20T00:00:00.000Z"),
    });

    for (const task of tasks) {
      expect(task.referenceUid.startsWith(getReminderReferenceUidPrefix("booking-uid"))).toBe(true);
    }
  });
});
