import { getEventTypeReminderService } from "@calcom/features/reminders/di/EventTypeReminderService.container";
import type { TGetRemindersInputSchema, TUpdateRemindersInputSchema } from "./reminders.schema";

export const getRemindersHandler = async ({ input }: { input: TGetRemindersInputSchema }) => {
  const minutesBefore = await getEventTypeReminderService().getMinutesBefore(
    input.eventTypeId,
    input.channel
  );
  return { minutesBefore };
};

export const updateRemindersHandler = async ({ input }: { input: TUpdateRemindersInputSchema }) => {
  const minutesBefore = await getEventTypeReminderService().setMinutesBefore(
    input.eventTypeId,
    input.channel,
    input.minutesBefore
  );
  return { minutesBefore };
};
