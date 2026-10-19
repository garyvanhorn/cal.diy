import type { PrismaClient } from "@calcom/prisma";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BOOKING_REMINDER_TASK_TYPE, ReminderTaskRepository } from "./ReminderTaskRepository";

describe("ReminderTaskRepository", () => {
  const prismaClient = {
    task: { createMany: vi.fn(), deleteMany: vi.fn() },
  };
  const repository = new ReminderTaskRepository(prismaClient as unknown as PrismaClient);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("creates tasks idempotently with a serialized payload", async () => {
    prismaClient.task.createMany.mockResolvedValue({ count: 1 });
    const payload = {
      bookingUid: "booking-uid",
      attendeeId: 1,
      channel: "EMAIL" as const,
      minutesBefore: 60,
      startTime: "2026-10-25T15:00:00.000Z",
    };

    const count = await repository.createMany([
      {
        referenceUid: "reminder:booking-uid:1:EMAIL:60",
        scheduledAt: new Date("2026-10-25T14:00:00.000Z"),
        payload,
      },
    ]);

    expect(count).toBe(1);
    expect(prismaClient.task.createMany).toHaveBeenCalledWith({
      data: [
        {
          type: BOOKING_REMINDER_TASK_TYPE,
          referenceUid: "reminder:booking-uid:1:EMAIL:60",
          scheduledAt: new Date("2026-10-25T14:00:00.000Z"),
          payload: JSON.stringify(payload),
          maxAttempts: 3,
        },
      ],
      skipDuplicates: true,
    });
  });

  it("skips the query when there is nothing to create", async () => {
    await expect(repository.createMany([])).resolves.toBe(0);
    expect(prismaClient.task.createMany).not.toHaveBeenCalled();
  });

  it("deletes only unsent reminder tasks under the prefix", async () => {
    prismaClient.task.deleteMany.mockResolvedValue({ count: 2 });

    await expect(repository.deletePendingByReferenceUidPrefix("reminder:booking-uid:")).resolves.toBe(2);
    expect(prismaClient.task.deleteMany).toHaveBeenCalledWith({
      where: {
        type: BOOKING_REMINDER_TASK_TYPE,
        succeededAt: null,
        referenceUid: { startsWith: "reminder:booking-uid:" },
      },
    });
  });
});
