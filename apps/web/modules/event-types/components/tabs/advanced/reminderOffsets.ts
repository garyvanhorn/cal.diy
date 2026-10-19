export type ReminderUnit = "minutes" | "hours" | "days";

const MINUTES_PER_UNIT: Record<ReminderUnit, number> = { minutes: 1, hours: 60, days: 24 * 60 };

export function toReminderMinutes(amount: number, unit: ReminderUnit): number {
  return Math.round(amount * MINUTES_PER_UNIT[unit]);
}

/** Picks the largest unit that represents the offset exactly, e.g. 1440 → 1 day, 90 → 90 minutes. */
export function splitReminderMinutes(minutes: number): { amount: number; unit: ReminderUnit } {
  if (minutes % MINUTES_PER_UNIT.days === 0) return { amount: minutes / MINUTES_PER_UNIT.days, unit: "days" };
  if (minutes % MINUTES_PER_UNIT.hours === 0)
    return { amount: minutes / MINUTES_PER_UNIT.hours, unit: "hours" };
  return { amount: minutes, unit: "minutes" };
}

export function getReminderLabelKey(unit: ReminderUnit): string {
  return `reminder_${unit}_before`;
}
