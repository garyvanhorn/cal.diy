import type { PrismaClient } from "@calcom/prisma";
import { describe, expect, it, vi } from "vitest";
import { AttendeeRepository } from "./AttendeeRepository";

describe("AttendeeRepository attendance confirmation", () => {
  it("sets confirmedAt only if it is still unset", async () => {
    const prismaClient = { attendee: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };
    const repository = new AttendeeRepository(prismaClient as unknown as PrismaClient);
    const confirmedAt = new Date("2026-10-20T00:00:00.000Z");

    await expect(repository.updateConfirmedAtIfUnset({ id: 5, confirmedAt })).resolves.toBe(1);
    expect(prismaClient.attendee.updateMany).toHaveBeenCalledWith({
      where: { id: 5, confirmedAt: null },
      data: { confirmedAt },
    });
  });

  it("selects only the booking fields the confirm page shows", async () => {
    const prismaClient = { attendee: { findUnique: vi.fn().mockResolvedValue(null) } };
    const repository = new AttendeeRepository(prismaClient as unknown as PrismaClient);

    await repository.findByIdIncludeBooking(5);

    expect(prismaClient.attendee.findUnique).toHaveBeenCalledWith({
      where: { id: 5 },
      select: {
        id: true,
        name: true,
        timeZone: true,
        locale: true,
        confirmedAt: true,
        booking: { select: { uid: true, title: true, startTime: true, endTime: true, status: true } },
      },
    });
  });
});
