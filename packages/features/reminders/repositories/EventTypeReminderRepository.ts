import type { PrismaClient } from "@calcom/prisma";
import type { ReminderChannelDto, ReminderRuleDto } from "../lib/types";

export class EventTypeReminderRepository {
  constructor(private readonly prismaClient: PrismaClient) {}

  async findByEventTypeId(eventTypeId: number): Promise<ReminderRuleDto[]> {
    return this.prismaClient.eventTypeReminder.findMany({
      where: { eventTypeId },
      select: { channel: true, minutesBefore: true },
      orderBy: { minutesBefore: "desc" },
    });
  }

  async replaceForChannel({
    eventTypeId,
    channel,
    minutesBefore,
  }: {
    eventTypeId: number;
    channel: ReminderChannelDto;
    minutesBefore: number[];
  }): Promise<void> {
    await this.prismaClient.$transaction([
      this.prismaClient.eventTypeReminder.deleteMany({ where: { eventTypeId, channel } }),
      this.prismaClient.eventTypeReminder.createMany({
        data: minutesBefore.map((minutes) => ({ eventTypeId, channel, minutesBefore: minutes })),
      }),
    ]);
  }
}
