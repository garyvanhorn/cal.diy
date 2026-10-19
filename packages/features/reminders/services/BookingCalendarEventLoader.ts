import { getBooking } from "@calcom/features/bookings/lib/payment/getBooking";

export type BookingCalendarEvent = Pick<Awaited<ReturnType<typeof getBooking>>, "evt" | "eventType">;

export class BookingCalendarEventLoader {
  async load(bookingId: number): Promise<BookingCalendarEvent> {
    const { evt, eventType } = await getBooking(bookingId);
    return { evt, eventType };
  }
}
