import { sendAttendeeReminderEmail } from "@calcom/emails/email-manager";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PrismaAttendeeReminderRepository,
  UpcomingBookingForAttendeeReminder,
} from "../repositories/PrismaAttendeeReminderRepository";
import { AttendeeReminderService } from "./AttendeeReminderService";

vi.mock("@calcom/emails/email-manager", () => ({
  sendAttendeeReminderEmail: vi.fn().mockResolvedValue(undefined),
  shouldSkipAttendeeEmailWithSettings: (metadata?: { disableStandardEmails?: { all?: { attendee?: boolean } } }) =>
    !!metadata?.disableStandardEmails?.all?.attendee,
}));

vi.mock("@calcom/i18n/server", () => ({
  getTranslation: vi.fn().mockResolvedValue((key: string) => key),
}));

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-11-02T14:00:00.000Z");

const buildBooking = (overrides: Partial<UpcomingBookingForAttendeeReminder> = {}) =>
  ({
    id: 1,
    uid: "uid-1",
    title: "Consultation",
    description: null,
    customInputs: null,
    responses: { name: "Alex", email: "alex@example.com" },
    location: "integrations:daily",
    metadata: { videoCallUrl: "https://app.cronslot.com/video/uid-1" },
    startTime: new Date(now.getTime() + 0.9 * HOUR),
    endTime: new Date(now.getTime() + 1.4 * HOUR),
    createdAt: new Date(now.getTime() - 72 * HOUR),
    userPrimaryEmail: null,
    iCalUID: null,
    iCalSequence: 0,
    attendees: [
      { name: "Alex", email: "alex@example.com", timeZone: "America/New_York", locale: "en", bookingSeat: null },
    ],
    user: {
      name: "Sam",
      username: "sam",
      email: "sam@example.com",
      timeZone: "UTC",
      locale: "en",
      timeFormat: 12,
    },
    eventType: {
      title: "Consultation",
      metadata: null,
      bookingFields: null,
      recurringEvent: null,
      seatsPerTimeSlot: null,
      seatsShowAttendees: null,
      hideOrganizerEmail: false,
      hideCalendarNotes: false,
      customReplyToEmail: null,
    },
    ...overrides,
  }) as UpcomingBookingForAttendeeReminder;

const buildRepository = ({
  bookings,
  sent = [],
}: {
  bookings: UpcomingBookingForAttendeeReminder[];
  sent?: { referenceId: number; elapsedMinutes: number }[];
}) => {
  const repository = {
    findUpcomingAcceptedBookingsIncludeAttendees: vi.fn().mockResolvedValueOnce(bookings).mockResolvedValue([]),
    findSentByBookingIds: vi.fn().mockResolvedValue(sent),
    createSent: vi.fn().mockResolvedValue(undefined),
  };
  return repository;
};

const createService = (repository: ReturnType<typeof buildRepository>) =>
  new AttendeeReminderService({
    attendeeReminderRepository: repository as unknown as PrismaAttendeeReminderRepository,
  });

describe("AttendeeReminderService", () => {
  beforeEach(() => {
    vi.mocked(sendAttendeeReminderEmail).mockClear();
  });

  it("looks ahead by the longest supported offset", async () => {
    const repository = buildRepository({ bookings: [] });
    await createService(repository).sendDueReminders(now);

    expect(repository.findUpcomingAcceptedBookingsIncludeAttendees).toHaveBeenCalledWith({
      startAfter: now,
      startBefore: new Date(now.getTime() + 48 * HOUR),
      afterId: undefined,
      take: 200,
    });
  });

  it("emails each attendee once and records the reminder", async () => {
    const repository = buildRepository({ bookings: [buildBooking()] });
    const result = await createService(repository).sendDueReminders(now);

    expect(result).toEqual({ remindersSent: 1 });
    expect(sendAttendeeReminderEmail).toHaveBeenCalledTimes(1);
    const [calEvent, attendee] = vi.mocked(sendAttendeeReminderEmail).mock.calls[0];
    expect(attendee).toMatchObject({ email: "alex@example.com", timeZone: "America/New_York" });
    expect(calEvent).toMatchObject({
      uid: "uid-1",
      title: "Consultation",
      organizer: { name: "Sam", email: "sam@example.com" },
      videoCallData: { url: "https://app.cronslot.com/video/uid-1" },
    });
    // 24 h was missed (created 72 h ahead, cron saw it only now), so both are recorded
    expect(repository.createSent).toHaveBeenCalledWith({ bookingId: 1, offsetsMinutes: [1440, 60] });
  });

  it("does not send a reminder that was already recorded", async () => {
    const repository = buildRepository({
      bookings: [buildBooking()],
      sent: [
        { referenceId: 1, elapsedMinutes: 1440 },
        { referenceId: 1, elapsedMinutes: 60 },
      ],
    });
    const result = await createService(repository).sendDueReminders(now);

    expect(result).toEqual({ remindersSent: 0 });
    expect(sendAttendeeReminderEmail).not.toHaveBeenCalled();
    expect(repository.createSent).not.toHaveBeenCalled();
  });

  it("respects an event type that turned reminders off", async () => {
    const booking = buildBooking();
    const repository = buildRepository({
      bookings: [
        { ...booking, eventType: { ...booking.eventType!, metadata: { attendeeReminders: { enabled: false } } } },
      ],
    });
    await createService(repository).sendDueReminders(now);

    expect(sendAttendeeReminderEmail).not.toHaveBeenCalled();
  });

  it("respects an event type that disabled all attendee emails", async () => {
    const booking = buildBooking();
    const repository = buildRepository({
      bookings: [
        {
          ...booking,
          eventType: {
            ...booking.eventType!,
            metadata: { disableStandardEmails: { all: { attendee: true } } },
          },
        },
      ],
    });
    await createService(repository).sendDueReminders(now);

    expect(sendAttendeeReminderEmail).not.toHaveBeenCalled();
  });

  it("gives each seat holder their own seat for the reschedule and cancel links", async () => {
    const repository = buildRepository({
      bookings: [
        buildBooking({
          attendees: [
            { name: "A", email: "a@example.com", timeZone: "UTC", locale: "en", bookingSeat: { referenceUid: "seat-a" } },
            { name: "B", email: "b@example.com", timeZone: "UTC", locale: "fr", bookingSeat: { referenceUid: "seat-b" } },
          ],
        }),
      ],
    });
    await createService(repository).sendDueReminders(now);

    const calls = vi.mocked(sendAttendeeReminderEmail).mock.calls;
    expect(calls.map(([calEvent, attendee]) => [attendee.email, calEvent.attendeeSeatId])).toEqual([
      ["a@example.com", "seat-a"],
      ["b@example.com", "seat-b"],
    ]);
    expect(calls[1][1].language.locale).toBe("fr");
  });

  it("does not record the reminder when sending fails, so the next run retries", async () => {
    vi.mocked(sendAttendeeReminderEmail).mockRejectedValueOnce(new Error("smtp down"));
    const repository = buildRepository({ bookings: [buildBooking()] });
    const result = await createService(repository).sendDueReminders(now);

    expect(result).toEqual({ remindersSent: 0 });
    expect(repository.createSent).not.toHaveBeenCalled();
  });

  it("skips bookings without an organizer", async () => {
    const repository = buildRepository({ bookings: [buildBooking({ user: null })] });
    await createService(repository).sendDueReminders(now);

    expect(sendAttendeeReminderEmail).not.toHaveBeenCalled();
    expect(repository.createSent).not.toHaveBeenCalled();
  });
});
