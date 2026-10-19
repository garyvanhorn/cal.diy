import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventTypeReminderService } from "./EventTypeReminderService";

describe("EventTypeReminderService", () => {
  const eventTypeReminderRepository = {
    findByEventTypeIdIncludeManagedParent: vi.fn(),
    replaceForChannel: vi.fn(),
  };
  const service = new EventTypeReminderService({ eventTypeReminderRepository });

  const standalone = (rules: { channel: "EMAIL" | "SMS"; minutesBefore: number }[]) => ({
    rules,
    metadata: {},
    parentRules: null,
  });
  const unlocked = { managedEventConfig: { unlockedFields: { reminders: true } } };

  beforeEach(() => {
    vi.resetAllMocks();
    eventTypeReminderRepository.findByEventTypeIdIncludeManagedParent.mockResolvedValue(standalone([]));
  });

  it("returns the offsets for the requested channel", async () => {
    eventTypeReminderRepository.findByEventTypeIdIncludeManagedParent.mockResolvedValue(
      standalone([
        { channel: "EMAIL", minutesBefore: 1440 },
        { channel: "SMS", minutesBefore: 60 },
        { channel: "EMAIL", minutesBefore: 120 },
      ])
    );

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

  describe("managed event type children", () => {
    const parentRules = [{ channel: "EMAIL" as const, minutesBefore: 1440 }];
    const childRules = [{ channel: "EMAIL" as const, minutesBefore: 30 }];

    it("returns no rules for an unknown event type", async () => {
      eventTypeReminderRepository.findByEventTypeIdIncludeManagedParent.mockResolvedValue(null);

      await expect(service.getEffectiveRules(7)).resolves.toEqual([]);
    });

    it("uses the parent's rules while reminders are locked, ignoring the child's rows", async () => {
      eventTypeReminderRepository.findByEventTypeIdIncludeManagedParent.mockResolvedValue({
        rules: childRules,
        metadata: { managedEventConfig: { unlockedFields: { locations: true } } },
        parentRules,
      });

      await expect(service.getEffectiveRules(42)).resolves.toEqual(parentRules);
      await expect(service.getMinutesBefore(42, "EMAIL")).resolves.toEqual([1440]);
    });

    it("uses the child's own rules once reminders are unlocked", async () => {
      eventTypeReminderRepository.findByEventTypeIdIncludeManagedParent.mockResolvedValue({
        rules: childRules,
        metadata: unlocked,
        parentRules,
      });

      await expect(service.getEffectiveRules(42)).resolves.toEqual(childRules);
    });

    it("falls back to the parent's rules when an unlocked child has none", async () => {
      eventTypeReminderRepository.findByEventTypeIdIncludeManagedParent.mockResolvedValue({
        rules: [],
        metadata: unlocked,
        parentRules,
      });

      await expect(service.getEffectiveRules(42)).resolves.toEqual(parentRules);
    });

    it("refuses to edit a locked child's reminders", async () => {
      eventTypeReminderRepository.findByEventTypeIdIncludeManagedParent.mockResolvedValue({
        rules: [],
        metadata: {},
        parentRules,
      });

      await expect(service.setMinutesBefore(42, "EMAIL", [60])).rejects.toThrow("managed by its team");
      expect(eventTypeReminderRepository.replaceForChannel).not.toHaveBeenCalled();
    });

    it("lets an unlocked child save its own reminders", async () => {
      eventTypeReminderRepository.findByEventTypeIdIncludeManagedParent.mockResolvedValue({
        rules: [],
        metadata: unlocked,
        parentRules,
      });

      await expect(service.setMinutesBefore(42, "EMAIL", [60])).resolves.toEqual([60]);
    });
  });
});
