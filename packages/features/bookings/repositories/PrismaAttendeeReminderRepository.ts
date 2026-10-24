import type { PrismaClient } from "@calcom/prisma/client";
import { BookingStatus, ReminderType } from "@calcom/prisma/enums";

const upcomingBookingSelect = {
  id: true,
  uid: true,
  title: true,
  description: true,
  customInputs: true,
  responses: true,
  location: true,
  metadata: true,
  startTime: true,
  endTime: true,
  createdAt: true,
  userPrimaryEmail: true,
  iCalUID: true,
  iCalSequence: true,
  attendees: {
    select: {
      name: true,
      email: true,
      timeZone: true,
      locale: true,
      bookingSeat: { select: { referenceUid: true } },
    },
  },
  user: {
    select: {
      name: true,
      username: true,
      email: true,
      timeZone: true,
      locale: true,
      timeFormat: true,
    },
  },
  eventType: {
    select: {
      title: true,
      metadata: true,
      bookingFields: true,
      recurringEvent: true,
      seatsPerTimeSlot: true,
      seatsShowAttendees: true,
      hideOrganizerEmail: true,
      hideCalendarNotes: true,
      customReplyToEmail: true,
    },
  },
} as const;

export type UpcomingBookingForAttendeeReminder = NonNullable<
  Awaited<ReturnType<PrismaAttendeeReminderRepository["findUpcomingAcceptedBookingsIncludeAttendees"]>>[number]
>;

export class PrismaAttendeeReminderRepository {
  constructor(private prismaClient: PrismaClient) {}

  /** Accepted bookings that need no payment or are already paid, ordered by id for cursor paging. */
  async findUpcomingAcceptedBookingsIncludeAttendees({
    startAfter,
    startBefore,
    afterId,
    take,
  }: {
    startAfter: Date;
    startBefore: Date;
    afterId?: number;
    take: number;
  }) {
    return this.prismaClient.booking.findMany({
      where: {
        status: BookingStatus.ACCEPTED,
        startTime: { gt: startAfter, lte: startBefore },
        OR: [{ payment: { none: {} } }, { paid: true }],
        ...(afterId !== undefined && { id: { gt: afterId } }),
      },
      select: upcomingBookingSelect,
      orderBy: { id: "asc" },
      take,
    });
  }

  async findSentByBookingIds(bookingIds: number[]) {
    if (!bookingIds.length) return [];
    return this.prismaClient.reminderMail.findMany({
      where: {
        reminderType: ReminderType.ATTENDEE_BOOKING_REMINDER,
        referenceId: { in: bookingIds },
      },
      select: { referenceId: true, elapsedMinutes: true },
    });
  }

  async createSent({ bookingId, offsetsMinutes }: { bookingId: number; offsetsMinutes: number[] }) {
    await this.prismaClient.reminderMail.createMany({
      data: offsetsMinutes.map((offset) => ({
        referenceId: bookingId,
        reminderType: ReminderType.ATTENDEE_BOOKING_REMINDER,
        elapsedMinutes: offset,
      })),
    });
  }
}
