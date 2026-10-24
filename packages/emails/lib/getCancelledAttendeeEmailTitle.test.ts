import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { getCancelledAttendeeEmailTitle } from "./getCancelledAttendeeEmailTitle";

const t = ((key: string, opts: Record<string, string>) =>
  key === "event_between_users"
    ? `${opts.eventName} between ${opts.host} and ${opts.attendeeName}`
    : key) as unknown as TFunction;

const base = {
  attendeeName: "Pat Lee",
  host: "Gary VanHorn",
  eventDuration: 60,
  t,
};

describe("getCancelledAttendeeEmailTitle", () => {
  it("keeps the stored booking title when the event type has no custom name", () => {
    const bookingTitle = "Deposit test between Gary VanHorn and Pat Lee";

    expect(
      getCancelledAttendeeEmailTitle(bookingTitle, { ...base, eventType: bookingTitle, eventName: null })
    ).toBe(bookingTitle);
  });

  it("re-renders a custom event name for the attendee", () => {
    expect(
      getCancelledAttendeeEmailTitle("Call with Pat Lee", {
        ...base,
        eventType: "Call with Pat Lee",
        eventName: "Call with {Scheduler}",
      })
    ).toBe("Call with Pat Lee");
  });
});
