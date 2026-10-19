import type { PrismaClient } from "@calcom/prisma";
import type { ScheduledReminderTask } from "../lib/types";

const MAX_ATTEMPTS = 3;
export const BOOKING_REMINDER_TASK_TYPE = "sendBookingReminder";

export class ReminderTaskRepository {
  constructor(private readonly prismaClient: PrismaClient) {}

  async createMany(tasks: ScheduledReminderTask[]): Promise<number> {
    if (tasks.length === 0) return 0;
    const result = await this.prismaClient.task.createMany({
      data: tasks.map((task) => ({
        type: BOOKING_REMINDER_TASK_TYPE,
        referenceUid: task.referenceUid,
        scheduledAt: task.scheduledAt,
        payload: JSON.stringify(task.payload),
        maxAttempts: MAX_ATTEMPTS,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async deletePendingByReferenceUidPrefix(referenceUidPrefix: string): Promise<number> {
    const result = await this.prismaClient.task.deleteMany({
      where: {
        type: BOOKING_REMINDER_TASK_TYPE,
        succeededAt: null,
        referenceUid: { startsWith: referenceUidPrefix },
      },
    });
    return result.count;
  }
}
