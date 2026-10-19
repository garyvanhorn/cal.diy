import type { PrismaClient } from "@calcom/prisma";
import type { EventTypeRemindersWithManagedParentDto, ReminderChannelDto } from "../lib/types";

const rulesSelect = {
  select: { channel: true, minutesBefore: true },
  orderBy: { minutesBefore: "desc" },
} as const;

export class EventTypeReminderRepository {
  constructor(private readonly prismaClient: PrismaClient) {}

  async findByEventTypeIdIncludeManagedParent(
    eventTypeId: number
  ): Promise<EventTypeRemindersWithManagedParentDto | null> {
    const eventType = await this.prismaClient.eventType.findUnique({
      where: { id: eventTypeId },
      select: {
        metadata: true,
        reminders: rulesSelect,
        parent: { select: { reminders: rulesSelect } },
      },
    });
    if (!eventType) return null;
    return {
      rules: eventType.reminders,
      metadata: eventType.metadata,
      parentRules: eventType.parent?.reminders ?? null,
    };
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
