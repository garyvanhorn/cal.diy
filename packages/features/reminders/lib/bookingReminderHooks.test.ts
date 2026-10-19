import { beforeEach, describe, expect, it, vi } from "vitest";
import { cancelBookingReminders, scheduleBookingReminders } from "./bookingReminderHooks";

const { scheduleForBookingUid, cancelForBooking } = vi.hoisted(() => ({
  scheduleForBookingUid: vi.fn(),
  cancelForBooking: vi.fn(),
}));

vi.mock("../di/ReminderSchedulerService.container", () => ({
  getReminderSchedulerService: () => ({ scheduleForBookingUid, cancelForBooking }),
}));

describe("bookingReminderHooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("schedules every booking", async () => {
    scheduleForBookingUid.mockResolvedValue(2);

    await scheduleBookingReminders(["a", "b"]);

    expect(scheduleForBookingUid.mock.calls).toEqual([["a"], ["b"]]);
  });

  it("cancels every booking", async () => {
    cancelForBooking.mockResolvedValue(1);

    await cancelBookingReminders(["a", "b"]);

    expect(cancelForBooking.mock.calls).toEqual([["a"], ["b"]]);
  });

  it("never throws, and keeps going past a failed booking", async () => {
    scheduleForBookingUid.mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce(1);
    cancelForBooking.mockRejectedValue(new Error("db down"));

    await expect(scheduleBookingReminders(["a", "b"])).resolves.toBeUndefined();
    await expect(cancelBookingReminders(["a"])).resolves.toBeUndefined();
    expect(scheduleForBookingUid).toHaveBeenCalledTimes(2);
  });

  it("does nothing for an empty list", async () => {
    await scheduleBookingReminders([]);
    await cancelBookingReminders([]);

    expect(scheduleForBookingUid).not.toHaveBeenCalled();
    expect(cancelForBooking).not.toHaveBeenCalled();
  });
});
