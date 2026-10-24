import { sendAttendeeReminderEmail, shouldSkipAttendeeEmailWithSettings } from "@calcom/emails/email-manager";
import { getCalEventResponses } from "@calcom/features/bookings/lib/getCalEventResponses";
import { buildCalEventFromBooking } from "@calcom/lib/buildCalEventFromBooking";
import { isPrismaObjOrUndefined } from "@calcom/lib/isPrismaObj";
import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import { getTimeFormatStringFromUserTimeFormat } from "@calcom/lib/timeFormat";
import { bookingMetadataSchema, EventTypeMetaDataSchema } from "@calcom/prisma/zod-utils";
import type { CalendarEvent } from "@calcom/types/Calendar";
import {
  getAttendeeReminderOffsets,
  getDueAttendeeReminderOffsets,
  MAX_ATTENDEE_REMINDER_OFFSET_MINUTES,
} from "../lib/attendeeReminders";
import type {
  PrismaAttendeeReminderRepository,
  UpcomingBookingForAttendeeReminder,
} from "../repositories/PrismaAttendeeReminderRepository";

const log = logger.getSubLogger({ prefix: ["AttendeeReminderService"] });

const PAGE_SIZE = 200;

export interface IAttendeeReminderServiceDeps {
  attendeeReminderRepository: PrismaAttendeeReminderRepository;
}

export class AttendeeReminderService {
  constructor(private readonly deps: IAttendeeReminderServiceDeps) {}

  async sendDueReminders(now: Date = new Date()): Promise<{ remindersSent: number }> {
    const startBefore = new Date(now.getTime() + MAX_ATTENDEE_REMINDER_OFFSET_MINUTES * 60 * 1000);
    let remindersSent = 0;
    let afterId: number | undefined;

    while (true) {
      const bookings =
        await this.deps.attendeeReminderRepository.findUpcomingAcceptedBookingsIncludeAttendees({
          startAfter: now,
          startBefore,
          afterId,
          take: PAGE_SIZE,
        });
      if (!bookings.length) break;

      const sent = await this.deps.attendeeReminderRepository.findSentByBookingIds(
        bookings.map((booking) => booking.id)
      );
      const sentOffsetsByBookingId = new Map<number, Set<number>>();
      for (const row of sent) {
        const offsets = sentOffsetsByBookingId.get(row.referenceId) ?? new Set<number>();
        offsets.add(row.elapsedMinutes);
        sentOffsetsByBookingId.set(row.referenceId, offsets);
      }

      for (const booking of bookings) {
        const wasSent = await this.remindIfDue({
          booking,
          now,
          sentOffsetsMinutes: sentOffsetsByBookingId.get(booking.id) ?? new Set(),
        });
        if (wasSent) remindersSent++;
      }

      if (bookings.length < PAGE_SIZE) break;
      afterId = bookings[bookings.length - 1].id;
    }

    return { remindersSent };
  }

  private async remindIfDue({
    booking,
    now,
    sentOffsetsMinutes,
  }: {
    booking: UpcomingBookingForAttendeeReminder;
    now: Date;
    sentOffsetsMinutes: Set<number>;
  }): Promise<boolean> {
    const parsedMetadata = EventTypeMetaDataSchema.safeParse(booking.eventType?.metadata);
    const eventTypeMetadata = parsedMetadata.success ? parsedMetadata.data : null;
    if (shouldSkipAttendeeEmailWithSettings(eventTypeMetadata)) return false;

    const dueOffsets = getDueAttendeeReminderOffsets({
      startTime: booking.startTime,
      createdAt: booking.createdAt,
      now,
      offsetsMinutes: getAttendeeReminderOffsets(eventTypeMetadata),
      sentOffsetsMinutes,
    });
    if (!dueOffsets.length) return false;

    const calEvent = await this.buildCalendarEvent(booking);
    if (!calEvent) return false;

    // Record before sending so a reminder goes out at most once: a missed reminder is
    // better than emailing an attendee every 5 minutes if the write keeps failing.
    // Recording every due offset means a late cron run sends one reminder, not 24 h and 1 h back to back.
    await this.deps.attendeeReminderRepository.createSent({
      bookingId: booking.id,
      offsetsMinutes: dueOffsets,
    });

    try {
      await Promise.all(
        calEvent.attendees.map((attendee, index) =>
          sendAttendeeReminderEmail(
            {
              ...calEvent,
              attendeeSeatId: booking.attendees[index]?.bookingSeat?.referenceUid ?? undefined,
            },
            attendee
          )
        )
      );
    } catch (error) {
      log.error(`Failed to send attendee reminder for booking ${booking.id}`, safeStringify(error));
      return false;
    }
    return true;
  }

  private async buildCalendarEvent(
    booking: UpcomingBookingForAttendeeReminder
  ): Promise<CalendarEvent | null> {
    const { user } = booking;
    if (!user) {
      log.warn(`Booking ${booking.id} has no organizer, skipping attendee reminder`);
      return null;
    }

    const baseEvent = await buildCalEventFromBooking({
      booking: { ...booking, destinationCalendar: null, user: { destinationCalendar: null } },
      organizer: { ...user, name: user.name || user.username },
      location: booking.location ?? "",
      conferenceCredentialId: null,
      organizationId: null,
    });

    const bookingMetadata = bookingMetadataSchema.safeParse(booking.metadata);
    const videoCallUrl = bookingMetadata.success ? bookingMetadata.data?.videoCallUrl : undefined;

    return {
      ...baseEvent,
      organizer: {
        ...baseEvent.organizer,
        timeFormat: getTimeFormatStringFromUserTimeFormat(user.timeFormat),
      },
      customInputs: isPrismaObjOrUndefined(booking.customInputs),
      ...getCalEventResponses({ bookingFields: booking.eventType?.bookingFields ?? null, booking }),
      hideCalendarNotes: booking.eventType?.hideCalendarNotes,
      videoCallData: videoCallUrl ? { type: "", id: "", password: "", url: videoCallUrl } : undefined,
    };
  }
}
