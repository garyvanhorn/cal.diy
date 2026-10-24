import { getReplyToHeader } from "@calcom/lib/getReplyToHeader";
import type { CalendarEvent, Person } from "@calcom/types/Calendar";
import renderEmail from "../src/renderEmail";
import AttendeeScheduledEmail from "./attendee-scheduled-email";

export default class AttendeeReminderEmail extends AttendeeScheduledEmail {
  constructor(calEvent: CalendarEvent, attendee: Person) {
    super(calEvent, attendee);
    this.name = "SEND_BOOKING_REMINDER";
  }

  // No .ics attachment: the attendee already has the event from the confirmation email,
  // and some mail clients would add it to their calendar a second time.
  protected async getNodeMailerPayload(): Promise<Record<string, unknown>> {
    return {
      to: `${this.attendee.name} <${this.attendee.email}>`,
      from: `${this.calEvent.organizer.name} <${this.getMailerOptions().from}>`,
      ...getReplyToHeader(
        this.calEvent,
        this.calEvent.attendees.filter(({ email }) => email !== this.attendee.email).map(({ email }) => email)
      ),
      subject: this.t("attendee_reminder_email_subject", {
        title: this.calEvent.title,
        date: this.getFormattedDate(),
        interpolation: { escapeValue: false },
      }),
      html: await renderEmail("AttendeeReminderEmail", {
        calEvent: this.calEvent,
        attendee: this.attendee,
      }),
      text: this.getTextBody("attendee_reminder_email_title", "attendee_reminder_email_subtitle"),
    };
  }
}
