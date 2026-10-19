import { z } from "zod";

// SMS is not offered yet; widening this enum is all the API needs when it is.
const ZReminderChannel = z.enum(["EMAIL"]).default("EMAIL");

export const ZGetRemindersInputSchema = z.object({
  eventTypeId: z.number().int(),
  channel: ZReminderChannel,
});

export const ZUpdateRemindersInputSchema = z.object({
  eventTypeId: z.number().int(),
  channel: ZReminderChannel,
  minutesBefore: z.array(z.number().int()),
});

export type TGetRemindersInputSchema = z.infer<typeof ZGetRemindersInputSchema>;
export type TUpdateRemindersInputSchema = z.infer<typeof ZUpdateRemindersInputSchema>;
