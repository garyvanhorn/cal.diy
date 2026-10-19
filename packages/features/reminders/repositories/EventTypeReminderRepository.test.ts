import type { PrismaClient } from "@calcom/prisma";
import { describe, expect, it, vi } from "vitest";
import { EventTypeReminderRepository } from "./EventTypeReminderRepository";

describe("EventTypeReminderRepository", () => {
  it("selects only channel and offset for the event type, earliest reminder first", async () => {
    const rules = [{ channel: "EMAIL", minutesBefore: 1440 }];
    const prismaClient = { eventTypeReminder: { findMany: vi.fn().mockResolvedValue(rules) } };
    const repository = new EventTypeReminderRepository(prismaClient as unknown as PrismaClient);

    await expect(repository.findByEventTypeId(7)).resolves.toBe(rules);
    expect(prismaClient.eventTypeReminder.findMany).toHaveBeenCalledWith({
      where: { eventTypeId: 7 },
      select: { channel: true, minutesBefore: true },
      orderBy: { minutesBefore: "desc" },
    });
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
