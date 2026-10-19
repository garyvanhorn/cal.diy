import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendBookingReminder } from "./sendBookingReminder";

const { deliver } = vi.hoisted(() => ({ deliver: vi.fn() }));

vi.mock("@calcom/features/reminders/di/ReminderDeliveryService.container", () => ({
  getReminderDeliveryService: () => ({ deliver }),
}));

const payload = {
  bookingUid: "booking-uid",
  attendeeId: 1,
  channel: "EMAIL",
  minutesBefore: 60,
  startTime: "2026-10-25T15:00:00.000Z",
};

describe("sendBookingReminder", () => {
  beforeEach(() => {
    deliver.mockReset();
  });

  it("delivers the parsed reminder", async () => {
    deliver.mockResolvedValue({ sent: true });

    await sendBookingReminder(JSON.stringify(payload));

    expect(deliver).toHaveBeenCalledWith(payload);
  });

  it("completes without error when delivery is skipped", async () => {
    deliver.mockResolvedValue({ sent: false, reason: "booking_not_accepted" });

    await expect(sendBookingReminder(JSON.stringify(payload))).resolves.toBeUndefined();
  });

  it("rejects an invalid payload", async () => {
    await expect(sendBookingReminder(JSON.stringify({ ...payload, minutesBefore: -5 }))).rejects.toThrow();
    expect(deliver).not.toHaveBeenCalled();
  });

  it("propagates delivery errors so the task is retried", async () => {
    deliver.mockRejectedValue(new Error("SMTP down"));

    await expect(sendBookingReminder(JSON.stringify(payload))).rejects.toThrow("SMTP down");
  });
});
