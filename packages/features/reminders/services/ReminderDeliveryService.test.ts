import { BookingStatus } from "@calcom/prisma/enums";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingReminderTaskPayload } from "../lib/types";
import { EventTypeReminderService } from "./EventTypeReminderService";
import { ReminderDeliveryService } from "./ReminderDeliveryService";

const now = new Date("2026-10-20T00:00:00.000Z");
const payload: BookingReminderTaskPayload = {
  bookingUid: "booking-uid",
  attendeeId: 1,
  channel: "EMAIL",
  minutesBefore: 120,
  startTime: "2026-10-25T15:00:00.000Z",
};
const acceptedBooking = {
  uid: "booking-uid",
  status: BookingStatus.ACCEPTED,
  startTime: new Date("2026-10-25T15:00:00.000Z"),
  eventTypeId: 7,
  paid: false,
  attendees: [{ id: 1 }],
  payment: [] as { success: boolean }[],
};

describe("ReminderDeliveryService", () => {
  const bookingRepository = { findByUidIncludeAttendeesAndPayments: vi.fn() };
  const eventTypeReminderService = { getEffectiveRules: vi.fn() };
  const sender = { send: vi.fn() };
  const reminderSenderFactory = { getSender: vi.fn() };
  let service: ReminderDeliveryService;

  beforeEach(() => {
    vi.resetAllMocks();
    bookingRepository.findByUidIncludeAttendeesAndPayments.mockResolvedValue(acceptedBooking);
    eventTypeReminderService.getEffectiveRules.mockResolvedValue([{ channel: "EMAIL", minutesBefore: 120 }]);
    reminderSenderFactory.getSender.mockReturnValue(sender);
    service = new ReminderDeliveryService({
      bookingRepository,
      eventTypeReminderService,
      reminderSenderFactory,
    });
  });

  it("sends through the sender for the payload's channel", async () => {
    await expect(service.deliver(payload, now)).resolves.toEqual({ sent: true });

    expect(reminderSenderFactory.getSender).toHaveBeenCalledWith("EMAIL");
    expect(sender.send).toHaveBeenCalledWith({
      bookingUid: "booking-uid",
      attendeeId: 1,
      minutesBefore: 120,
    });
  });

  it("sends when a payment succeeded", async () => {
    bookingRepository.findByUidIncludeAttendeesAndPayments.mockResolvedValue({
      ...acceptedBooking,
      payment: [{ success: true }],
    });

    await expect(service.deliver(payload, now)).resolves.toEqual({ sent: true });
  });

  it.each([
    ["booking_not_found", null],
    ["booking_not_accepted", { ...acceptedBooking, status: BookingStatus.CANCELLED }],
    ["booking_not_accepted", { ...acceptedBooking, status: BookingStatus.PENDING }],
    ["booking_moved", { ...acceptedBooking, startTime: new Date("2026-10-26T15:00:00.000Z") }],
    ["payment_pending", { ...acceptedBooking, payment: [{ success: false }] }],
    ["attendee_removed", { ...acceptedBooking, attendees: [{ id: 2 }] }],
    ["rule_removed", { ...acceptedBooking, eventTypeId: null }],
  ])("skips with %s", async (reason, booking) => {
    bookingRepository.findByUidIncludeAttendeesAndPayments.mockResolvedValue(booking);

    await expect(service.deliver(payload, now)).resolves.toEqual({ sent: false, reason });
    expect(sender.send).not.toHaveBeenCalled();
  });

  it("skips once the booking has started", async () => {
    const result = await service.deliver(payload, new Date("2026-10-25T15:00:00.000Z"));

    expect(result).toEqual({ sent: false, reason: "booking_started" });
  });

  it("skips when the rule was removed from the event type", async () => {
    eventTypeReminderService.getEffectiveRules.mockResolvedValue([{ channel: "EMAIL", minutesBefore: 1440 }]);

    await expect(service.deliver(payload, now)).resolves.toEqual({ sent: false, reason: "rule_removed" });
    expect(sender.send).not.toHaveBeenCalled();
  });

  it("lets sender errors propagate so the task is retried", async () => {
    sender.send.mockRejectedValue(new Error("SMTP down"));

    await expect(service.deliver(payload, now)).rejects.toThrow("SMTP down");
  });

  it("checks a child booking's reminder against the parent's current rules", async () => {
    const eventTypeReminderRepository = {
      findByEventTypeIdIncludeManagedParent: vi.fn().mockResolvedValue({
        rules: [],
        metadata: {},
        parentRules: [{ channel: "EMAIL", minutesBefore: 1440 }],
      }),
      replaceForChannel: vi.fn(),
    };
    service = new ReminderDeliveryService({
      bookingRepository,
      eventTypeReminderService: new EventTypeReminderService({ eventTypeReminderRepository }),
      reminderSenderFactory,
    });

    await expect(service.deliver({ ...payload, minutesBefore: 1440 }, now)).resolves.toEqual({ sent: true });
    await expect(service.deliver(payload, now)).resolves.toEqual({ sent: false, reason: "rule_removed" });
  });
});
