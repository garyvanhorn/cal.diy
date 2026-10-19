import type { BookingRepository } from "@calcom/features/bookings/repositories/BookingRepository";
import { BookingStatus } from "@calcom/prisma/enums";
import type { BookingReminderTaskPayload } from "../lib/types";
import type { EventTypeReminderRepository } from "../repositories/EventTypeReminderRepository";
import type { ReminderSenderFactory } from "./ReminderSenderFactory";

export interface IReminderDeliveryServiceDeps {
  bookingRepository: Pick<BookingRepository, "findByUidIncludeAttendeesAndPayments">;
  eventTypeReminderRepository: Pick<EventTypeReminderRepository, "findByEventTypeId">;
  reminderSenderFactory: Pick<ReminderSenderFactory, "getSender">;
}

export type ReminderSkipReason =
  | "booking_not_found"
  | "booking_not_accepted"
  | "booking_moved"
  | "booking_started"
  | "payment_pending"
  | "rule_removed"
  | "attendee_removed";

export type ReminderDeliveryResult = { sent: true } | { sent: false; reason: ReminderSkipReason };

export class ReminderDeliveryService {
  constructor(private readonly deps: IReminderDeliveryServiceDeps) {}

  /**
   * Re-checks the booking at send time instead of relying on every cancel/reschedule
   * path to delete its tasks, so a stale task is skipped rather than sent.
   */
  async deliver(
    payload: BookingReminderTaskPayload,
    now: Date = new Date()
  ): Promise<ReminderDeliveryResult> {
    const skipReason = await this.getSkipReason(payload, now);
    if (skipReason) return { sent: false, reason: skipReason };

    await this.deps.reminderSenderFactory.getSender(payload.channel).send({
      bookingUid: payload.bookingUid,
      attendeeId: payload.attendeeId,
      minutesBefore: payload.minutesBefore,
    });
    return { sent: true };
  }

  private async getSkipReason(
    payload: BookingReminderTaskPayload,
    now: Date
  ): Promise<ReminderSkipReason | null> {
    const booking = await this.deps.bookingRepository.findByUidIncludeAttendeesAndPayments({
      bookingUid: payload.bookingUid,
    });
    if (!booking) return "booking_not_found";
    if (booking.status !== BookingStatus.ACCEPTED) return "booking_not_accepted";
    if (booking.startTime.toISOString() !== payload.startTime) return "booking_moved";
    if (booking.startTime <= now) return "booking_started";

    const awaitingPayment =
      !booking.paid && booking.payment.length > 0 && !booking.payment.some((p) => p.success);
    if (awaitingPayment) return "payment_pending";

    if (!booking.attendees.some((attendee) => attendee.id === payload.attendeeId)) return "attendee_removed";

    if (!booking.eventTypeId) return "rule_removed";
    const rules = await this.deps.eventTypeReminderRepository.findByEventTypeId(booking.eventTypeId);
    const ruleStillActive = rules.some(
      (rule) => rule.channel === payload.channel && rule.minutesBefore === payload.minutesBefore
    );
    if (!ruleStillActive) return "rule_removed";

    return null;
  }
}
