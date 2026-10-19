import { ErrorWithCode } from "@calcom/lib/errors";
import {
  MAX_REMINDER_MINUTES,
  MAX_REMINDERS_PER_EVENT_TYPE,
  MIN_REMINDER_MINUTES,
} from "../lib/reminderSettings";
import type { ReminderChannelDto } from "../lib/types";
import type { EventTypeReminderRepository } from "../repositories/EventTypeReminderRepository";

export interface IEventTypeReminderServiceDeps {
  eventTypeReminderRepository: Pick<EventTypeReminderRepository, "findByEventTypeId" | "replaceForChannel">;
}

export class EventTypeReminderService {
  constructor(private readonly deps: IEventTypeReminderServiceDeps) {}

  async getMinutesBefore(eventTypeId: number, channel: ReminderChannelDto): Promise<number[]> {
    const rules = await this.deps.eventTypeReminderRepository.findByEventTypeId(eventTypeId);
    return rules.filter((rule) => rule.channel === channel).map((rule) => rule.minutesBefore);
  }

  /**
   * Replaces the channel's offsets. Bookings already made keep their scheduled reminders,
   * except ones whose offset was removed: delivery skips those at send time.
   */
  async setMinutesBefore(
    eventTypeId: number,
    channel: ReminderChannelDto,
    minutesBefore: number[]
  ): Promise<number[]> {
    const unique = Array.from(new Set(minutesBefore)).sort((a, b) => b - a);
    if (unique.length > MAX_REMINDERS_PER_EVENT_TYPE) {
      throw ErrorWithCode.Factory.BadRequest(
        `An event type can have at most ${MAX_REMINDERS_PER_EVENT_TYPE} reminders per channel`
      );
    }
    const outOfRange = unique.find(
      (minutes) =>
        !Number.isInteger(minutes) || minutes < MIN_REMINDER_MINUTES || minutes > MAX_REMINDER_MINUTES
    );
    if (outOfRange !== undefined) {
      throw ErrorWithCode.Factory.BadRequest(
        `Reminder offset ${outOfRange} must be a whole number of minutes between ${MIN_REMINDER_MINUTES} and ${MAX_REMINDER_MINUTES}`
      );
    }

    await this.deps.eventTypeReminderRepository.replaceForChannel({
      eventTypeId,
      channel,
      minutesBefore: unique,
    });
    return unique;
  }
}
