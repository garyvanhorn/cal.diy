import { z } from "zod";

export type ReminderChannelDto = "EMAIL" | "SMS";

export type ReminderRuleDto = {
  channel: ReminderChannelDto;
  minutesBefore: number;
};

export type EventTypeRemindersWithManagedParentDto = {
  rules: ReminderRuleDto[];
  metadata: unknown;
  /** Null unless the event type is a managed event type's child. */
  parentRules: ReminderRuleDto[] | null;
};

export const bookingReminderTaskPayloadSchema = z.object({
  bookingUid: z.string(),
  attendeeId: z.number().int(),
  channel: z.enum(["EMAIL", "SMS"]),
  minutesBefore: z.number().int().positive(),
  startTime: z.string().datetime(),
});

export type BookingReminderTaskPayload = z.infer<typeof bookingReminderTaskPayloadSchema>;

export type ScheduledReminderTask = {
  referenceUid: string;
  scheduledAt: Date;
  payload: BookingReminderTaskPayload;
};

export type ReminderSendInput = {
  bookingUid: string;
  attendeeId: number;
  minutesBefore: number;
};

export interface IReminderSender {
  send(input: ReminderSendInput): Promise<void>;
}
