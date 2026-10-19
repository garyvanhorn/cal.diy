import type { AttendeeRepository } from "@calcom/features/bookings/repositories/AttendeeRepository";
import { BookingStatus } from "@calcom/prisma/enums";
import { verifyAttendanceConfirmationToken } from "../lib/attendanceConfirmationToken";

export interface IAttendanceConfirmationServiceDeps {
  attendeeRepository: Pick<AttendeeRepository, "findByIdIncludeBooking" | "updateConfirmedAtIfUnset">;
}

export type AttendanceConfirmationDetails = {
  attendeeName: string;
  timeZone: string;
  locale: string | null;
  bookingUid: string;
  title: string;
  startTime: Date;
  endTime: Date;
};

export type AttendanceConfirmationState =
  | { status: "invalid" }
  | { status: "unavailable"; details: AttendanceConfirmationDetails }
  | { status: "ready" | "confirmed"; details: AttendanceConfirmationDetails };

export class AttendanceConfirmationService {
  constructor(private readonly deps: IAttendanceConfirmationServiceDeps) {}

  async getState(token: string, now: Date = new Date()): Promise<AttendanceConfirmationState> {
    const claims = verifyAttendanceConfirmationToken(token);
    if (!claims) return { status: "invalid" };

    const attendee = await this.deps.attendeeRepository.findByIdIncludeBooking(claims.attendeeId);
    // The token is bound to both ids, so an attendee moved to another booking can't confirm that one.
    if (!attendee?.booking || attendee.booking.uid !== claims.bookingUid) return { status: "invalid" };

    const details: AttendanceConfirmationDetails = {
      attendeeName: attendee.name,
      timeZone: attendee.timeZone,
      locale: attendee.locale,
      bookingUid: attendee.booking.uid,
      title: attendee.booking.title,
      startTime: attendee.booking.startTime,
      endTime: attendee.booking.endTime,
    };

    if (attendee.booking.status !== BookingStatus.ACCEPTED || attendee.booking.endTime <= now) {
      return { status: "unavailable", details };
    }
    return { status: attendee.confirmedAt ? "confirmed" : "ready", details };
  }

  async confirm(token: string, now: Date = new Date()): Promise<AttendanceConfirmationState> {
    const state = await this.getState(token, now);
    if (state.status !== "ready") return state;

    const claims = verifyAttendanceConfirmationToken(token);
    if (!claims) return { status: "invalid" };
    await this.deps.attendeeRepository.updateConfirmedAtIfUnset({ id: claims.attendeeId, confirmedAt: now });
    return { status: "confirmed", details: state.details };
  }
}
