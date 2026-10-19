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
  if (key === "reminder_email") return `Reminder: ${vars?.eventType} with ${vars?.name} at ${vars?.date}`;
  return key;
}) as unknown as TFunction;

const language = { translate: t, locale: "en" };
const attendee: Person = {
  name: "Guest",
  email: "guest@example.com",
  timeZone: "America/Chicago",
  language,
};
const calEvent = {
  type: "consult",
  title: "Consultation",
  uid: "booking-uid",
  bookerUrl: "https://book.client.example",
  startTime: "2026-11-02T15:00:00.000Z",
  endTime: "2026-11-02T15:30:00.000Z",
  organizer: { name: "Dana", email: "dana@client.example", timeZone: "America/New_York", language },
  attendees: [attendee],
} as unknown as CalendarEvent;

describe("AttendeeReminderEmail", () => {
  it("renders the subject in the attendee's time zone with confirm, reschedule and cancel links", async () => {
    const confirmUrl = "https://book.client.example/attendance/confirm?token=abc.def";
    const payload = await new TestAttendeeReminderEmail(calEvent, attendee, confirmUrl).getPayload();

    expect(payload.to).toBe("Guest <guest@example.com>");
    expect(payload.subject).toBe(
      "Reminder: Consultation with Dana at 9:00am - 9:30am, monday, november 2, 2026"
    );
    expect(payload.html).toContain(confirmUrl.replace("&", "&amp;"));
    expect(payload.html).toContain("confirm_attendance");
    expect(payload.html).toContain("https://book.client.example/reschedule/booking-uid");
    expect(payload.html).toContain("https://book.client.example/booking/booking-uid?cancel=true");
    expect(payload.text).toContain(`confirm_attendance: ${confirmUrl}`);
  });

  it("drops the confirm button once the attendee has confirmed", async () => {
    const payload = await new TestAttendeeReminderEmail(calEvent, attendee, null).getPayload();

    expect(payload.html).not.toContain("confirm_attendance");
    expect(payload.html).toContain("attendee_reminder_confirmed_subtitle");
    expect(payload.text).not.toContain("confirm_attendance");
  });
});
