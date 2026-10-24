import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBookingForPaymentProcessing, handleNoShowFee } = vi.hoisted(() => ({
  getBookingForPaymentProcessing: vi.fn(),
  handleNoShowFee: vi.fn(),
}));

vi.mock("@calcom/features/bookings/repositories/BookingRepository", () => ({
  BookingRepository: class {
    getBookingForPaymentProcessing = getBookingForPaymentProcessing;
  },
}));

vi.mock("@calcom/features/bookings/lib/payment/handleNoShowFee", () => ({ handleNoShowFee }));

import { chargeCardHandler } from "./chargeCard.handler";

type HandlerOptions = Parameters<typeof chargeCardHandler>[0];

const ORGANIZER_ID = 7;

const callHandler = (userId: number) =>
  chargeCardHandler({
    ctx: { user: { id: userId }, prisma: {} },
    input: { bookingId: 9 },
  } as unknown as HandlerOptions);

const heldBooking = (overrides: Record<string, unknown> = {}) => ({
  id: 9,
  userId: ORGANIZER_ID,
  payment: [{ id: 1, success: false }],
  ...overrides,
});

describe("chargeCardHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("charges the held card for the booking's organizer", async () => {
    const booking = heldBooking();
    getBookingForPaymentProcessing.mockResolvedValue(booking);

    await callHandler(ORGANIZER_ID);

    expect(handleNoShowFee).toHaveBeenCalledWith({ booking, payment: booking.payment[0] });
  });

  it("refuses to charge a booking that belongs to someone else", async () => {
    getBookingForPaymentProcessing.mockResolvedValue(heldBooking());

    await expect(callHandler(ORGANIZER_ID + 1)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(handleNoShowFee).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when the booking doesn't exist", async () => {
    getBookingForPaymentProcessing.mockResolvedValue(null);

    await expect(callHandler(ORGANIZER_ID)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects a booking with no card on file", async () => {
    getBookingForPaymentProcessing.mockResolvedValue(heldBooking({ payment: [] }));

    await expect(callHandler(ORGANIZER_ID)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(handleNoShowFee).not.toHaveBeenCalled();
  });

  it("doesn't charge twice", async () => {
    getBookingForPaymentProcessing.mockResolvedValue(heldBooking({ payment: [{ id: 1, success: true }] }));

    await expect(callHandler(ORGANIZER_ID)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(handleNoShowFee).not.toHaveBeenCalled();
  });
});
