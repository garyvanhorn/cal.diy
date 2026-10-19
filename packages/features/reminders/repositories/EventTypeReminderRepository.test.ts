import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@calcom/prisma";

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
});
