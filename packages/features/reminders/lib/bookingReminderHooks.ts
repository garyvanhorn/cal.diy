import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import { getReminderSchedulerService } from "../di/ReminderSchedulerService.container";

const log = logger.getSubLogger({ prefix: ["bookingReminderHooks"] });

// Reminders are a side effect of booking changes: a failure here is logged and must never
// fail the booking, cancel or confirm request that triggered it.
async function runForEach(
  action: string,
  bookingUids: string[],
  run: (bookingUid: string) => Promise<unknown>
): Promise<void> {
  const results = await Promise.allSettled(bookingUids.map((bookingUid) => run(bookingUid)));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      log.error(
        `Failed to ${action} reminders`,
        safeStringify({ bookingUid: bookingUids[index], error: result.reason })
      );
    }
  });
}

export async function scheduleBookingReminders(bookingUids: string[]): Promise<void> {
  await runForEach("schedule", bookingUids, (bookingUid) =>
    getReminderSchedulerService().scheduleForBookingUid(bookingUid)
  );
}

export async function cancelBookingReminders(bookingUids: string[]): Promise<void> {
  await runForEach("cancel", bookingUids, (bookingUid) =>
    getReminderSchedulerService().cancelForBooking(bookingUid)
  );
}
