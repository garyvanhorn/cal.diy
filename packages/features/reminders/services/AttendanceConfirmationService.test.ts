import { BookingStatus } from "@calcom/prisma/enums";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAttendanceConfirmationToken } from "../lib/attendanceConfirmationToken";
import { AttendanceConfirmationService } from "./AttendanceConfirmationService";

const now = new Date("2026-10-20T00:00:00.000Z");
const attendee = {
  id: 5,
  name: "Guest",
  timeZone: "America/Chicago",
  locale: "en",
  confirmedAt: null as Date | null,
  booking: {
    uid: "booking-uid",
    title: "Consultation",
    startTime: new Date("2026-10-25T15:00:00.000Z"),
    endTime: new Date("2026-10-25T15:30:00.000Z"),
    status: BookingStatus.ACCEPTED as BookingStatus,
  },
};

describe("AttendanceConfirmationService", () => {
  const attendeeRepository = { findByIdIncludeBooking: vi.fn(), updateConfirmedAtIfUnset: vi.fn() };
  const service = new AttendanceConfirmationService({ attendeeRepository });
  let token: string;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
    token = createAttendanceConfirmationToken({ bookingUid: "booking-uid", attendeeId: 5 });
    attendeeRepository.findByIdIncludeBooking.mockResolvedValue(attendee);
    attendeeRepository.updateConfirmedAtIfUnset.mockResolvedValue(1);
  });

  it("is ready to confirm an upcoming accepted booking", async () => {
    const state = await service.getState(token, now);

    expect(state).toEqual({
      status: "ready",
      details: expect.objectContaining({
        title: "Consultation",
        attendeeName: "Guest",
        timeZone: "America/Chicago",
      }),
    });
    expect(attendeeRepository.findByIdIncludeBooking).toHaveBeenCalledWith(5);
  });

  it("confirms and records the time", async () => {
    await expect(service.confirm(token, now)).resolves.toMatchObject({ status: "confirmed" });
    expect(attendeeRepository.updateConfirmedAtIfUnset).toHaveBeenCalledWith({ id: 5, confirmedAt: now });
  });

  it("reports an already confirmed attendee without writing again", async () => {
    attendeeRepository.findByIdIncludeBooking.mockResolvedValue({ ...attendee, confirmedAt: now });

    await expect(service.confirm(token, now)).resolves.toMatchObject({ status: "confirmed" });
    expect(attendeeRepository.updateConfirmedAtIfUnset).not.toHaveBeenCalled();
  });

  it.each([
    ["a tampered token", () => `${token}x`, attendee],
    ["a missing attendee", () => token, null],
    [
      "an attendee on another booking",
      () => token,
      { ...attendee, booking: { ...attendee.booking, uid: "other" } },
    ],
  ])("rejects %s", async (_case, getToken, found) => {
    attendeeRepository.findByIdIncludeBooking.mockResolvedValue(found);

    await expect(service.confirm(getToken(), now)).resolves.toEqual({ status: "invalid" });
    expect(attendeeRepository.updateConfirmedAtIfUnset).not.toHaveBeenCalled();
  });

  it.each([
    ["cancelled", { ...attendee.booking, status: BookingStatus.CANCELLED }],
    ["awaiting approval", { ...attendee.booking, status: BookingStatus.PENDING }],
    ["over", { ...attendee.booking, endTime: now }],
  ])("refuses when the booking is %s", async (_case, booking) => {
    attendeeRepository.findByIdIncludeBooking.mockResolvedValue({ ...attendee, booking });

    await expect(service.confirm(token, now)).resolves.toMatchObject({ status: "unavailable" });
    expect(attendeeRepository.updateConfirmedAtIfUnset).not.toHaveBeenCalled();
  });
});
