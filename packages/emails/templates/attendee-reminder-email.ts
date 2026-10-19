import { getReplyToHeader } from "@calcom/lib/getReplyToHeader";
import type { CalendarEvent, Person } from "@calcom/types/Calendar";
import renderEmail from "../src/renderEmail";
import AttendeeScheduledEmail from "./attendee-scheduled-email";

export default class AttendeeReminderEmail extends AttendeeScheduledEmail {
  constructor(
    calEvent: CalendarEvent,
    attendee: Person,
    private readonly confirmUrl: string | null
  ) {
    super(calEvent, attendee);
    this.name = "SEND_ATTENDEE_REMINDER";
  }

  protected async getNodeMailerPayload(): Promise<Record<string, unknown>> {
    return {
      to: `${this.attendee.name} <${this.attendee.email}>`,
      from: `${this.calEvent.organizer.name} <${this.getMailerOptions().from}>`,
      ...getReplyToHeader(this.calEvent),
      subject: this.t("reminder_email", {
        eventType: this.calEvent.title,
        name: this.calEvent.team?.name || this.calEvent.organizer.name,
        date: this.getFormattedDate(),
        interpolation: { escapeValue: false },
      }),
      html: await renderEmail("AttendeeReminderEmail", {
        calEvent: this.calEvent,
        attendee: this.attendee,
        confirmUrl: this.confirmUrl,
      }),
      text: this.getReminderTextBody(),
    };
  }

  private getReminderTextBody(): string {
    const body = this.getTextBody(
      "attendee_reminder_title",
      this.confirmUrl ? "attendee_reminder_subtitle" : "attendee_reminder_confirmed_subtitle"
    );
    return this.confirmUrl ? `${body}\n\n${this.t("confirm_attendance")}: ${this.confirmUrl}` : body;
  }
}
