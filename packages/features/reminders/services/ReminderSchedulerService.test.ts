import { BookingStatus } from "@calcom/prisma/enums";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReminderSchedulerService } from "./ReminderSchedulerService";

const now = new Date("2026-10-20T00:00:00.000Z");
const booking = {
  uid: "booking-uid",
  eventTypeId: 7,
  startTime: new Date("2026-10-25T15:00:00.000Z"),
  attendees: [{ id: 1 }],
};

describe("ReminderSchedulerService", () => {
  const bookingRepository = { findByUidIncludeAttendeesAndPayments: vi.fn() };
  const eventTypeReminderRepository = { findByEventTypeId: vi.fn() };
  const reminderTaskRepository = {
    createMany: vi.fn(),
    deletePendingByReferenceUidPrefix: vi.fn(),
  };
  let service: ReminderSchedulerService;

  beforeEach(() => {
    vi.resetAllMocks();
    reminderTaskRepository.createMany.mockImplementation(async (tasks: unknown[]) => tasks.length);
    reminderTaskRepository.deletePendingByReferenceUidPrefix.mockResolvedValue(0);
    service = new ReminderSchedulerService({
      bookingRepository,
      eventTypeReminderRepository,
      reminderTaskRepository,
    });
  });

  it("clears pending reminders, then schedules one per rule", async () => {
    eventTypeReminderRepository.findByEventTypeId.mockResolvedValue([
      { channel: "EMAIL", minutesBefore: 1440 },
      { channel: "EMAIL", minutesBefore: 120 },
    ]);

    const count = await service.scheduleForBooking(booking, now);

    expect(count).toBe(2);
    expect(reminderTaskRepository.deletePendingByReferenceUidPrefix).toHaveBeenCalledWith(
      "reminder:booking-uid:"
    );
    expect(eventTypeReminderRepository.findByEventTypeId).toHaveBeenCalledWith(7);
    const [tasks] = reminderTaskRepository.createMany.mock.calls[0];
    expect(tasks.map((task: { referenceUid: string }) => task.referenceUid)).toEqual([
      "reminder:booking-uid:1:EMAIL:1440",
      "reminder:booking-uid:1:EMAIL:120",
    ]);
    expect(reminderTaskRepository.deletePendingByReferenceUidPrefix.mock.invocationCallOrder[0]).toBeLessThan(
      reminderTaskRepository.createMany.mock.invocationCallOrder[0]
    );
  });

  it("only clears reminders when the booking has no event type", async () => {
    const count = await service.scheduleForBooking({ ...booking, eventTypeId: null }, now);

    expect(count).toBe(0);
    expect(reminderTaskRepository.deletePendingByReferenceUidPrefix).toHaveBeenCalledOnce();
    expect(eventTypeReminderRepository.findByEventTypeId).not.toHaveBeenCalled();
    expect(reminderTaskRepository.createMany).not.toHaveBeenCalled();
  });

  it("schedules nothing when the event type has no reminders", async () => {
    eventTypeReminderRepository.findByEventTypeId.mockResolvedValue([]);

    const count = await service.scheduleForBooking(booking, now);

    expect(count).toBe(0);
    expect(reminderTaskRepository.createMany).toHaveBeenCalledWith([]);
  });

  it("cancels pending reminders by booking prefix", async () => {
    reminderTaskRepository.deletePendingByReferenceUidPrefix.mockResolvedValue(3);

    await expect(service.cancelForBooking("booking-uid")).resolves.toBe(3);
    expect(reminderTaskRepository.deletePendingByReferenceUidPrefix).toHaveBeenCalledWith(
      "reminder:booking-uid:"
    );
  });

  describe("scheduleForBookingUid", () => {
    it.each([BookingStatus.ACCEPTED, BookingStatus.PENDING])("schedules a %s booking", async (status) => {
      bookingRepository.findByUidIncludeAttendeesAndPayments.mockResolvedValue({ ...booking, status });
      eventTypeReminderRepository.findByEventTypeId.mockResolvedValue([
        { channel: "EMAIL", minutesBefore: 60 },
      ]);

      await expect(service.scheduleForBookingUid("booking-uid", now)).resolves.toBe(1);
      expect(bookingRepository.findByUidIncludeAttendeesAndPayments).toHaveBeenCalledWith({
        bookingUid: "booking-uid",
      });
    });

    it.each([
      ["missing", null],
      ["cancelled", { ...booking, status: BookingStatus.CANCELLED }],
      ["rejected", { ...booking, status: BookingStatus.REJECTED }],
    ])("only clears reminders when the booking is %s", async (_case, found) => {
      bookingRepository.findByUidIncludeAttendeesAndPayments.mockResolvedValue(found);

      await expect(service.scheduleForBookingUid("booking-uid", now)).resolves.toBe(0);
      expect(reminderTaskRepository.deletePendingByReferenceUidPrefix).toHaveBeenCalledWith(
        "reminder:booking-uid:"
      );
      expect(reminderTaskRepository.createMany).not.toHaveBeenCalled();
    });
  });
});
