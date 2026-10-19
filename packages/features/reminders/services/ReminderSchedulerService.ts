import type { BookingRepository } from "@calcom/features/bookings/repositories/BookingRepository";
import { BookingStatus } from "@calcom/prisma/enums";
import { buildReminderTasks, getReminderReferenceUidPrefix } from "../lib/reminderTasks";
import type { EventTypeReminderRepository } from "../repositories/EventTypeReminderRepository";
import type { ReminderTaskRepository } from "../repositories/ReminderTaskRepository";

export interface IReminderSchedulerServiceDeps {
  bookingRepository: Pick<BookingRepository, "findByUidIncludeAttendeesAndPayments">;
  eventTypeReminderRepository: Pick<EventTypeReminderRepository, "findByEventTypeId">;
  reminderTaskRepository: Pick<ReminderTaskRepository, "createMany" | "deletePendingByReferenceUidPrefix">;
}

export type ReminderSchedulingBooking = {
  uid: string;
  eventTypeId: number | null;
  startTime: Date;
  attendees: { id: number }[];
};

export class ReminderSchedulerService {
  constructor(private readonly deps: IReminderSchedulerServiceDeps) {}

  /**
   * Replaces any pending reminders for the booking, so calling it again after an
   * update (host accept, attendee added, rules changed) never double-sends.
   */
  async scheduleForBooking(booking: ReminderSchedulingBooking, now: Date = new Date()): Promise<number> {
    await this.cancelForBooking(booking.uid);
    if (!booking.eventTypeId) return 0;

    const rules = await this.deps.eventTypeReminderRepository.findByEventTypeId(booking.eventTypeId);
    const tasks = buildReminderTasks({ booking, rules, now });
    return this.deps.reminderTaskRepository.createMany(tasks);
  }

  async scheduleForBookingUid(bookingUid: string, now: Date = new Date()): Promise<number> {
    const booking = await this.deps.bookingRepository.findByUidIncludeAttendeesAndPayments({ bookingUid });
    if (!booking || booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.REJECTED) {
      return this.cancelForBooking(bookingUid).then(() => 0);
    }
    // Pending bookings (awaiting payment or host approval) are scheduled too; delivery re-checks
    // the status at send time, so they only go out if the booking was accepted by then.
    return this.scheduleForBooking(booking, now);
  }

  async cancelForBooking(bookingUid: string): Promise<number> {
    return this.deps.reminderTaskRepository.deletePendingByReferenceUidPrefix(
      getReminderReferenceUidPrefix(bookingUid)
    );
  }
}
