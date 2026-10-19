import type { ReminderRuleDto, ScheduledReminderTask } from "./types";

const MS_PER_MINUTE = 60_000;

export function getReminderReferenceUidPrefix(bookingUid: string): string {
  return `reminder:${bookingUid}:`;
}

export function buildReminderTasks({
  booking,
  rules,
  now,
}: {
  booking: { uid: string; startTime: Date; attendees: { id: number }[] };
  rules: ReminderRuleDto[];
  now: Date;
}): ScheduledReminderTask[] {
  const tasks: ScheduledReminderTask[] = [];
  const startTime = booking.startTime.toISOString();
  const prefix = getReminderReferenceUidPrefix(booking.uid);

  for (const rule of rules) {
    // Offsets are applied to the UTC instant, so DST changes between booking and meeting can't shift them.
    const scheduledAt = new Date(booking.startTime.getTime() - rule.minutesBefore * MS_PER_MINUTE);
    // A reminder whose time has already passed (e.g. a same-day booking with a 24h rule) is dropped, not sent late.
    if (scheduledAt <= now) continue;

    for (const attendee of booking.attendees) {
      tasks.push({
        referenceUid: `${prefix}${attendee.id}:${rule.channel}:${rule.minutesBefore}`,
        scheduledAt,
        payload: {
          bookingUid: booking.uid,
          attendeeId: attendee.id,
          channel: rule.channel,
          minutesBefore: rule.minutesBefore,
          startTime,
        },
      });
    }
  }

  return tasks;
}
