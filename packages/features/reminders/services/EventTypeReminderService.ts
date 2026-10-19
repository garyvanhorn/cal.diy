import { ErrorWithCode } from "@calcom/lib/errors";
import { EventTypeMetaDataSchema } from "@calcom/prisma/zod-utils";
import {
  MAX_REMINDER_MINUTES,
  MAX_REMINDERS_PER_EVENT_TYPE,
  MIN_REMINDER_MINUTES,
} from "../lib/reminderSettings";
import type {
  EventTypeRemindersWithManagedParentDto,
  ReminderChannelDto,
  ReminderRuleDto,
} from "../lib/types";
import type { EventTypeReminderRepository } from "../repositories/EventTypeReminderRepository";

export interface IEventTypeReminderServiceDeps {
  eventTypeReminderRepository: Pick<
    EventTypeReminderRepository,
    "findByEventTypeIdIncludeManagedParent" | "replaceForChannel"
  >;
}

const isManagedChild = (eventType: EventTypeRemindersWithManagedParentDto) => eventType.parentRules !== null;

// Same opt-in as webhooks on managed children: locked unless the team unlocks the field.
const areRemindersUnlocked = (eventType: EventTypeRemindersWithManagedParentDto) =>
  EventTypeMetaDataSchema.safeParse(eventType.metadata).data?.managedEventConfig?.unlockedFields
    ?.reminders === true;

export class EventTypeReminderService {
  constructor(private readonly deps: IEventTypeReminderServiceDeps) {}

  /**
   * Bookings on a managed event type's child carry the child's id, so a child resolves to its
   * parent's rules unless reminders are unlocked and the member has set their own.
   */
  async getEffectiveRules(eventTypeId: number): Promise<ReminderRuleDto[]> {
    const eventType =
      await this.deps.eventTypeReminderRepository.findByEventTypeIdIncludeManagedParent(eventTypeId);
    if (!eventType) return [];
    if (eventType.parentRules === null) return eventType.rules;
    if (areRemindersUnlocked(eventType) && eventType.rules.length > 0) return eventType.rules;
    return eventType.parentRules;
  }

  async getMinutesBefore(eventTypeId: number, channel: ReminderChannelDto): Promise<number[]> {
    const rules = await this.getEffectiveRules(eventTypeId);
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
    const eventType =
      await this.deps.eventTypeReminderRepository.findByEventTypeIdIncludeManagedParent(eventTypeId);
    if (eventType && isManagedChild(eventType) && !areRemindersUnlocked(eventType)) {
      throw ErrorWithCode.Factory.Forbidden(
        `Reminders on event type ${eventTypeId} are managed by its team's parent event type`
      );
    }

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
