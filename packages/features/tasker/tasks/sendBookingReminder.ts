import { bookingReminderTaskPayloadSchema } from "@calcom/features/reminders/lib/types";
import logger from "@calcom/lib/logger";

const log = logger.getSubLogger({ prefix: ["sendBookingReminder"] });

export async function sendBookingReminder(payload: string): Promise<void> {
  const reminder = bookingReminderTaskPayloadSchema.parse(JSON.parse(payload));
  const { getReminderDeliveryService } = await import(
    "@calcom/features/reminders/di/ReminderDeliveryService.container"
  );
  const result = await getReminderDeliveryService().deliver(reminder);
  if (!result.sent) {
    log.info("Skipped booking reminder", { bookingUid: reminder.bookingUid, reason: result.reason });
  }
}
