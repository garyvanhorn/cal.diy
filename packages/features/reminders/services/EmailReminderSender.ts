import AttendeeReminderEmail from "@calcom/emails/templates/attendee-reminder-email";
import type { AttendeeRepository } from "@calcom/features/bookings/repositories/AttendeeRepository";
import { WEBAPP_URL } from "@calcom/lib/constants";
import { buildAttendanceConfirmationUrl } from "../lib/attendanceConfirmationToken";
import type { IReminderSender, ReminderSendInput } from "../lib/types";
import type { BookingCalendarEventLoader } from "./BookingCalendarEventLoader";

export interface IEmailReminderSenderDeps {
  attendeeRepository: Pick<AttendeeRepository, "findByIdIncludeBookingSeat">;
  bookingCalendarEventLoader: Pick<BookingCalendarEventLoader, "load">;
}

export class EmailReminderSender implements IReminderSender {
  constructor(private readonly deps: IEmailReminderSenderDeps) {}

  async send({ bookingUid, attendeeId }: ReminderSendInput): Promise<void> {
    const attendee = await this.deps.attendeeRepository.findByIdIncludeBookingSeat(attendeeId);
    if (!attendee?.bookingId) return;

    const { evt, eventType } = await this.deps.bookingCalendarEventLoader.load(attendee.bookingId);
    if (eventType.metadata?.disableStandardEmails?.all?.attendee) return;

    const recipient = evt.attendees.find((person) => person.email === attendee.email);
    if (!recipient) return;

    // Without the seat reference, a seated attendee's cancel link would cancel the whole booking.
    const calEvent = { ...evt, attendeeSeatId: attendee.bookingSeat?.referenceUid };
    const confirmUrl = attendee.confirmedAt
      ? null
      : buildAttendanceConfirmationUrl(evt.bookerUrl ?? WEBAPP_URL, { bookingUid, attendeeId });

    await new AttendeeReminderEmail(calEvent, recipient, confirmUrl).sendEmail();
  }
}
