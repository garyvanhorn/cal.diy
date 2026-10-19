import type { PrismaClient } from "@calcom/prisma";
import type { ReminderRuleDto } from "../lib/types";

export class EventTypeReminderRepository {
  constructor(private readonly prismaClient: PrismaClient) {}

  async findByEventTypeId(eventTypeId: number): Promise<ReminderRuleDto[]> {
    return this.prismaClient.eventTypeReminder.findMany({
      where: { eventTypeId },
      select: { channel: true, minutesBefore: true },
      orderBy: { minutesBefore: "desc" },
    });
  }
}
