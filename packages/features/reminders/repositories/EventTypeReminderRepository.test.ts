import type { PrismaClient } from "@calcom/prisma";
import { describe, expect, it, vi } from "vitest";
import { EventTypeReminderRepository } from "./EventTypeReminderRepository";

describe("EventTypeReminderRepository", () => {
  const rulesSelect = {
    select: { channel: true, minutesBefore: true },
    orderBy: { minutesBefore: "desc" },
  };

  it("loads an event type's rules with its managed parent's rules in one query", async () => {
    const prismaClient = {
      eventType: {
        findUnique: vi.fn().mockResolvedValue({
          metadata: { managedEventConfig: {} },
          reminders: [],
          parent: { reminders: [{ channel: "EMAIL", minutesBefore: 1440 }] },
        }),
      },
    };
    const repository = new EventTypeReminderRepository(prismaClient as unknown as PrismaClient);

    await expect(repository.findByEventTypeIdIncludeManagedParent(42)).resolves.toEqual({
      rules: [],
      metadata: { managedEventConfig: {} },
      parentRules: [{ channel: "EMAIL", minutesBefore: 1440 }],
    });
    expect(prismaClient.eventType.findUnique).toHaveBeenCalledWith({
      where: { id: 42 },
      select: { metadata: true, reminders: rulesSelect, parent: { select: { reminders: rulesSelect } } },
    });
  });

  it.each([
    [
      "has no managed parent",
      { metadata: null, reminders: [], parent: null },
      { rules: [], metadata: null, parentRules: null },
    ],
    ["does not exist", null, null],
  ])("handles an event type that %s", async (_case, found, expected) => {
    const prismaClient = { eventType: { findUnique: vi.fn().mockResolvedValue(found) } };
    const repository = new EventTypeReminderRepository(prismaClient as unknown as PrismaClient);

    await expect(repository.findByEventTypeIdIncludeManagedParent(7)).resolves.toEqual(expected);
  });

  it("replaces one channel's offsets in a single transaction", async () => {
    const prismaClient = {
      $transaction: vi.fn().mockResolvedValue([]),
      eventTypeReminder: {
        deleteMany: vi.fn().mockReturnValue("delete-op"),
        createMany: vi.fn().mockReturnValue("create-op"),
      },
    };
    const repository = new EventTypeReminderRepository(prismaClient as unknown as PrismaClient);

    await repository.replaceForChannel({ eventTypeId: 7, channel: "EMAIL", minutesBefore: [1440, 60] });

    expect(prismaClient.eventTypeReminder.deleteMany).toHaveBeenCalledWith({
      where: { eventTypeId: 7, channel: "EMAIL" },
    });
    expect(prismaClient.eventTypeReminder.createMany).toHaveBeenCalledWith({
      data: [
        { eventTypeId: 7, channel: "EMAIL", minutesBefore: 1440 },
        { eventTypeId: 7, channel: "EMAIL", minutesBefore: 60 },
      ],
    });
    expect(prismaClient.$transaction).toHaveBeenCalledWith(["delete-op", "create-op"]);
  });
});
