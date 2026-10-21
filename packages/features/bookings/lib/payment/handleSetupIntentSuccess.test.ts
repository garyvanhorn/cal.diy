import type { IBookingPaymentRepository } from "@calcom/features/bookings/repositories/BookingPaymentRepository.interface";
import { BookingStatus } from "@calcom/prisma/enums";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBooking: vi.fn(),
  doesBookingRequireConfirmation: vi.fn(),
  eventManagerCreate: vi.fn(),
  handleConfirmation: vi.fn(),
  handleBookingRequested: vi.fn(),
  cancelWithReference: vi.fn(),
}));

vi.mock("@calcom/prisma", () => ({ default: {} }));
vi.mock("@calcom/features/bookings/lib/payment/getBooking", () => ({ getBooking: mocks.getBooking }));
vi.mock("@calcom/features/bookings/lib/doesBookingRequireConfirmation", () => ({
  doesBookingRequireConfirmation: mocks.doesBookingRequireConfirmation,
}));
vi.mock("@calcom/features/bookings/lib/EventManager", () => ({
  default: class {
    create = mocks.eventManagerCreate;
  },
  placeholderCreatedEvent: { referencesToCreate: [] },
}));
vi.mock("@calcom/features/bookings/lib/getAllCredentialsForUsersOnEvent/getAllCredentials", () => ({
  getAllCredentialsIncludeServiceAccountKey: vi.fn().mockResolvedValue([]),
}));
vi.mock("@calcom/features/bookings/lib/handleConfirmation", () => ({
  handleConfirmation: mocks.handleConfirmation,
}));
vi.mock("@calcom/features/bookings/lib/handleBookingRequested", () => ({
  handleBookingRequested: mocks.handleBookingRequested,
}));
vi.mock("@calcom/features/platform-oauth-client/platform-oauth-client.repository", () => ({
  PlatformOAuthClientRepository: class {
    getByUserId = vi.fn();
  },
}));
vi.mock("@calcom/features/tasker", () => ({ default: { cancelWithReference: mocks.cancelWithReference } }));

import { handleSetupIntentSuccess } from "./handleSetupIntentSuccess";

const setupIntent = { id: "seti_1", status: "succeeded" } as Stripe.SetupIntent;
const traceContext = { traceId: "trace", spanId: "span", operation: "test" };
const reference = { type: "google_calendar", uid: "gcal_1" };

const buildRepository = (payment: unknown) => {
  const repository = {
    findByExternalId: vi.fn().mockResolvedValue(payment),
    updateDataAndBooking: vi.fn(),
  };
  return repository as unknown as IBookingPaymentRepository & typeof repository;
};

const run = (repository: IBookingPaymentRepository) =>
  handleSetupIntentSuccess({ setupIntent, paymentRepository: repository, traceContext });

describe("handleSetupIntentSuccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBooking.mockResolvedValue({
      booking: { id: 9, uid: "booking_abc", location: "Office", eventType: { metadata: {} } },
      user: { id: 7, isPlatformManaged: false },
      evt: { title: "Consultation" },
      eventType: { id: 3, metadata: {} },
    });
    mocks.eventManagerCreate.mockResolvedValue({ referencesToCreate: [reference] });
    mocks.doesBookingRequireConfirmation.mockReturnValue(false);
  });

  it("does nothing when no payment matches the SetupIntent", async () => {
    const repository = buildRepository(null);

    expect(await run(repository)).toBe("No payment found for SetupIntent seti_1");
    expect(mocks.getBooking).not.toHaveBeenCalled();
  });

  it("does not confirm twice when Stripe redelivers the event", async () => {
    const repository = buildRepository({
      id: 5,
      bookingId: 9,
      success: false,
      data: { setupIntent: { id: "seti_1", status: "succeeded" } },
    });

    expect(await run(repository)).toBe("SetupIntent seti_1 was already handled");
    expect(mocks.eventManagerCreate).not.toHaveBeenCalled();
    expect(repository.updateDataAndBooking).not.toHaveBeenCalled();
  });

  it("marks the booking paid, accepts it and creates calendar events", async () => {
    const repository = buildRepository({
      id: 5,
      bookingId: 9,
      success: false,
      data: { setupIntent: { id: "seti_1", status: "requires_payment_method" }, stripeAccount: "acct_1" },
    });

    expect(await run(repository)).toBe("Card saved and booking 9 confirmed");
    expect(mocks.cancelWithReference).toHaveBeenCalledWith("booking_abc", "sendAwaitingPaymentEmail");
    expect(mocks.eventManagerCreate).toHaveBeenCalledWith(expect.objectContaining({ location: "Office" }));
    expect(repository.updateDataAndBooking).toHaveBeenCalledWith({
      paymentId: 5,
      data: { setupIntent, stripeAccount: "acct_1" },
      booking: {
        paid: true,
        status: BookingStatus.ACCEPTED,
        references: { create: [reference] },
      },
    });
    expect(mocks.handleConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 9, paid: true, traceContext })
    );
    expect(mocks.handleBookingRequested).not.toHaveBeenCalled();
  });

  it("leaves the booking pending and notifies the organizer when it requires confirmation", async () => {
    mocks.doesBookingRequireConfirmation.mockReturnValue(true);
    const repository = buildRepository({ id: 5, bookingId: 9, success: false, data: null });

    expect(await run(repository)).toBe("Card saved for booking 9; awaiting organizer confirmation");
    expect(mocks.eventManagerCreate).not.toHaveBeenCalled();
    expect(repository.updateDataAndBooking).toHaveBeenCalledWith({
      paymentId: 5,
      data: { setupIntent },
      booking: { paid: true },
    });
    expect(mocks.handleBookingRequested).toHaveBeenCalled();
    expect(mocks.handleConfirmation).not.toHaveBeenCalled();
  });

  it("still confirms the booking when the awaiting payment task cannot be cancelled", async () => {
    mocks.cancelWithReference.mockRejectedValue(new Error("tasker down"));
    const repository = buildRepository({ id: 5, bookingId: 9, success: false, data: {} });

    expect(await run(repository)).toBe("Card saved and booking 9 confirmed");
  });
});
