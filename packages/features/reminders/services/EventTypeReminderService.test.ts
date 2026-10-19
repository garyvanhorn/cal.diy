import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventTypeReminderService } from "./EventTypeReminderService";

describe("EventTypeReminderService", () => {
  const eventTypeReminderRepository = { findByEventTypeId: vi.fn(), replaceForChannel: vi.fn() };
  const service = new EventTypeReminderService({ eventTypeReminderRepository });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the offsets for the requested channel", async () => {
    eventTypeReminderRepository.findByEventTypeId.mockResolvedValue([
      { channel: "EMAIL", minutesBefore: 1440 },
      { channel: "SMS", minutesBefore: 60 },
      { channel: "EMAIL", minutesBefore: 120 },
    ]);

    await expect(service.getMinutesBefore(7, "EMAIL")).resolves.toEqual([1440, 120]);
  });

  it("saves de-duplicated offsets, latest-first", async () => {
    await expect(service.setMinutesBefore(7, "EMAIL", [60, 1440, 60])).resolves.toEqual([1440, 60]);
    expect(eventTypeReminderRepository.replaceForChannel).toHaveBeenCalledWith({
      eventTypeId: 7,
      channel: "EMAIL",
      minutesBefore: [1440, 60],
    });
  });

  it("clears reminders with an empty list", async () => {
    await expect(service.setMinutesBefore(7, "EMAIL", [])).resolves.toEqual([]);
    expect(eventTypeReminderRepository.replaceForChannel).toHaveBeenCalledWith({
      eventTypeId: 7,
      channel: "EMAIL",
      minutesBefore: [],
    });
  });

  it("rejects more than three reminders", async () => {
    await expect(service.setMinutesBefore(7, "EMAIL", [60, 120, 1440, 2880])).rejects.toThrow("at most 3");
    expect(eventTypeReminderRepository.replaceForChannel).not.toHaveBeenCalled();
  });

  it.each([0, 4, -60, 30.5, 30 * 24 * 60 + 1])("rejects an offset of %s minutes", async (minutes) => {
    await expect(service.setMinutesBefore(7, "EMAIL", [minutes])).rejects.toThrow(
      `Reminder offset ${minutes}`
    );
    expect(eventTypeReminderRepository.replaceForChannel).not.toHaveBeenCalled();
  });

  it("accepts the range limits", async () => {
    await expect(service.setMinutesBefore(7, "EMAIL", [5, 30 * 24 * 60])).resolves.toEqual([43200, 5]);
  });
});
