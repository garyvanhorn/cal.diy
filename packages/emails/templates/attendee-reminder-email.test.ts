import type { CalendarEvent, Person } from "@calcom/types/Calendar";
import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import AttendeeReminderEmail from "./attendee-reminder-email";

class TestAttendeeReminderEmail extends AttendeeReminderEmail {
  public async getPayload() {
    return await this.getNodeMailerPayload();
  }
}

const t = ((key: string, vars?: Record<string, unknown>) => {
  if (key === "attendee_reminder_email_subject") {
    return `Reminder: ${String(vars?.title)} on ${String(vars?.date)}`;
  }
  if (key === "attendee_reminder_email_title") return "Your appointment is coming up";
  return key;
}) as unknown as TFunction;

const buildPerson = (overrides: Partial<Person>): Person => ({
  name: "Person",
  email: "person@example.com",
  timeZone: "UTC",
  language: { translate: t, locale: "en" },
  ...overrides,
});

const attendee = buildPerson({
  name: "Alex Attendee",
  email: "alex@example.com",
  timeZone: "America/New_York",
});

const calEvent: CalendarEvent = {
  type: "consultation",
  title: "Consultation with Sam",
  startTime: "2026-11-02T15:00:00.000Z",
  endTime: "2026-11-02T15:30:00.000Z",
  uid: "booking-uid-123",
  bookerUrl: "https://app.cronslot.com",
  organizer: buildPerson({ name: "Sam Organizer", email: "sam@example.com" }),
  attendees: [attendee],
};

describe("AttendeeReminderEmail", () => {
  it("addresses the attendee and formats the subject date in the attendee's time zone", async () => {
    const payload = await new TestAttendeeReminderEmail(calEvent, attendee).getPayload();

    expect(payload.to).toBe("Alex Attendee <alex@example.com>");
    // 15:00 UTC is 10:00 in New York on 2 November 2026 (after the DST change)
    expect(payload.subject).toBe(
      "Reminder: Consultation with Sam on 10:00am - 10:30am, monday, november 2, 2026"
    );
  });

  it("does not attach an .ics file", async () => {
    const payload = await new TestAttendeeReminderEmail(calEvent, attendee).getPayload();

    expect(payload).not.toHaveProperty("icalEvent");
  });

  it("renders the reminder title and the reschedule and cancel links", async () => {
    const payload = await new TestAttendeeReminderEmail(calEvent, attendee).getPayload();
    const html = String(payload.html);

    expect(html).toContain("Your appointment is coming up");
    expect(html).toContain("Consultation with Sam");
    expect(html).toContain("https://app.cronslot.com/reschedule/booking-uid-123");
    expect(html).toContain("https://app.cronslot.com/booking/booking-uid-123?cancel=true");
  });
});
