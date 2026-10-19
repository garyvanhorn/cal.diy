import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyAttendanceConfirmationToken } from "../lib/attendanceConfirmationToken";
import { EmailReminderSender } from "./EmailReminderSender";

const { emailConstructor, sendEmail } = vi.hoisted(() => ({
  emailConstructor: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@calcom/emails/templates/attendee-reminder-email", () => ({
  default: vi.fn().mockImplementation(function (...args: unknown[]) {
    emailConstructor(...args);
    return { sendEmail };
  }),
}));

vi.mock("@calcom/features/bookings/lib/payment/getBooking", () => ({ getBooking: vi.fn() }));

const recipient = { email: "guest@example.com", name: "Guest", timeZone: "America/Chicago" };
const evt = {
  bookerUrl: "https://book.client.example",
  attendees: [recipient, { email: "other@example.com", name: "Other", timeZone: "UTC" }],
};
const attendee = {
  id: 5,
  email: "guest@example.com",
  bookingId: 10,
  confirmedAt: null as Date | null,
  bookingSeat: null as { referenceUid: string } | null,
};

describe("EmailReminderSender", () => {
  const attendeeRepository = { findByIdIncludeBookingSeat: vi.fn() };
  const bookingCalendarEventLoader = { load: vi.fn() };
  let sender: EmailReminderSender;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
    attendeeRepository.findByIdIncludeBookingSeat.mockResolvedValue(attendee);
    bookingCalendarEventLoader.load.mockResolvedValue({ evt, eventType: { metadata: null } });
    sender = new EmailReminderSender({ attendeeRepository, bookingCalendarEventLoader });
  });

  it("emails the attendee with a signed confirm link on the tenant domain", async () => {
    await sender.send({ bookingUid: "booking-uid", attendeeId: 5, minutesBefore: 120 });

    expect(bookingCalendarEventLoader.load).toHaveBeenCalledWith(10);
    const [calEvent, person, confirmUrl] = emailConstructor.mock.calls[0];
    expect(person).toBe(recipient);
    expect(calEvent.attendeeSeatId).toBeUndefined();
    const url = new URL(confirmUrl);
    expect(url.origin).toBe("https://book.client.example");
    expect(verifyAttendanceConfirmationToken(url.searchParams.get("token") ?? "")).toEqual({
      bookingUid: "booking-uid",
      attendeeId: 5,
    });
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("omits the confirm link once the attendee has confirmed", async () => {
    attendeeRepository.findByIdIncludeBookingSeat.mockResolvedValue({ ...attendee, confirmedAt: new Date() });

    await sender.send({ bookingUid: "booking-uid", attendeeId: 5, minutesBefore: 120 });

    expect(emailConstructor.mock.calls[0][2]).toBeNull();
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("scopes manage links to the attendee's seat", async () => {
    attendeeRepository.findByIdIncludeBookingSeat.mockResolvedValue({
      ...attendee,
      bookingSeat: { referenceUid: "seat-ref" },
    });

    await sender.send({ bookingUid: "booking-uid", attendeeId: 5, minutesBefore: 120 });

    expect(emailConstructor.mock.calls[0][0].attendeeSeatId).toBe("seat-ref");
  });

  it("respects the event type's disabled attendee emails", async () => {
    bookingCalendarEventLoader.load.mockResolvedValue({
      evt,
      eventType: { metadata: { disableStandardEmails: { all: { attendee: true } } } },
    });

    await sender.send({ bookingUid: "booking-uid", attendeeId: 5, minutesBefore: 120 });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it.each([
    ["the attendee is gone", null],
    ["the attendee has no booking", { ...attendee, bookingId: null }],
    ["the attendee is not on the event", { ...attendee, email: "someone@else.com" }],
  ])("sends nothing when %s", async (_case, found) => {
    attendeeRepository.findByIdIncludeBookingSeat.mockResolvedValue(found);

    await sender.send({ bookingUid: "booking-uid", attendeeId: 5, minutesBefore: 120 });

    expect(sendEmail).not.toHaveBeenCalled();
  });
});
