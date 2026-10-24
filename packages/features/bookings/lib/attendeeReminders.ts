import type { EventTypeMetadata } from "@calcom/prisma/zod-utils";

export const DEFAULT_ATTENDEE_REMINDER_OFFSETS_MINUTES = [24 * 60, 60];

// The cron only looks this far ahead, so offsets outside this list would never be sent.
export const ATTENDEE_REMINDER_OFFSET_OPTIONS_MINUTES = [30, 60, 2 * 60, 4 * 60, 12 * 60, 24 * 60, 48 * 60];

export const MAX_ATTENDEE_REMINDER_OFFSET_MINUTES = Math.max(...ATTENDEE_REMINDER_OFFSET_OPTIONS_MINUTES);

/** Reminders are on by default; an event type opts out with `attendeeReminders.enabled: false`. */
export function getAttendeeReminderOffsets(metadata: EventTypeMetadata | undefined): number[] {
  const settings = metadata?.attendeeReminders;
  if (settings?.enabled === false) return [];

  const offsets = settings?.offsetsMinutes ?? DEFAULT_ATTENDEE_REMINDER_OFFSETS_MINUTES;
  return [...new Set(offsets)].filter((offset) => ATTENDEE_REMINDER_OFFSET_OPTIONS_MINUTES.includes(offset));
}

/**
 * Returns the offsets whose send time has passed for a booking that hasn't started yet.
 * An offset is skipped when the booking was made after its send time, because the
 * confirmation email arrived inside that window anyway.
 */
export function getDueAttendeeReminderOffsets({
  startTime,
  createdAt,
  now,
  offsetsMinutes,
  sentOffsetsMinutes,
}: {
  startTime: Date;
  createdAt: Date;
  now: Date;
  offsetsMinutes: number[];
  sentOffsetsMinutes: Set<number>;
}): number[] {
  const startMs = startTime.getTime();
  if (now.getTime() >= startMs) return [];

  return offsetsMinutes.filter((offset) => {
    if (sentOffsetsMinutes.has(offset)) return false;
    const sendAtMs = startMs - offset * 60 * 1000;
    return now.getTime() >= sendAtMs && createdAt.getTime() <= sendAtMs;
  });
}
