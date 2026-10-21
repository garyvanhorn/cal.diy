import type { GetServerSidePropsContext } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findByUidIncludeBookingAndEventType: vi.fn(),
  getServerSession: vi.fn(),
  shouldHideBrandingForEvent: vi.fn(),
}));

vi.mock("@calcom/prisma", () => ({ default: {} }));

vi.mock("@calcom/features/bookings/repositories/PrismaBookingPaymentRepository", () => ({
  PrismaBookingPaymentRepository: class {
    findByUidIncludeBookingAndEventType = mocks.findByUidIncludeBookingAndEventType;
  },
}));

vi.mock("@calcom/features/auth/lib/getServerSession", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@calcom/features/profile/lib/hideBranding", () => ({
  shouldHideBrandingForEvent: mocks.shouldHideBrandingForEvent,
}));

import { getClientSecretFromPayment, getServerSideProps } from "./getServerSideProps";

const owner = { id: 7, name: "Gary", username: "gary", hideBranding: false, theme: "dark" };

type Overrides = Record<string, unknown>;

const buildPayment = (
  overrides: Overrides = {},
  bookingOverrides: Overrides = {},
  eventTypeOverrides: Overrides = {}
) => ({
  uid: "pay_123",
  success: false,
  refunded: false,
  bookingId: 11,
  appId: "stripe",
  amount: 5000,
  currency: "usd",
  paymentOption: "ON_BOOKING",
  data: { client_secret: "pi_secret", stripe_publishable_key: "pk_test" },
  booking: {
    id: 11,
    uid: "booking_abc",
    description: null,
    title: "Consultation",
    startTime: new Date("2026-11-02T15:00:00.000Z"),
    endTime: new Date("2026-11-02T15:30:00.000Z"),
    responses: {},
    user: { name: "Gary", timeZone: "America/New_York" },
    attendees: [],
    eventTypeId: 3,
    location: null,
    status: "PENDING",
    rejectionReason: null,
    cancellationReason: null,
    eventType: {
      id: 3,
      title: "Consultation",
      description: null,
      length: 30,
      eventName: null,
      requiresConfirmation: false,
      userId: 7,
      metadata: {},
      users: [owner],
      team: null,
      price: 5000,
      currency: "usd",
      successRedirectUrl: null,
      forwardParamsSuccessRedirect: true,
      ...eventTypeOverrides,
    },
    ...bookingOverrides,
  },
  ...overrides,
});

const buildContext = (query: Record<string, unknown> = { uid: "pay_123" }) =>
  ({ query, req: {} }) as unknown as GetServerSidePropsContext;

const loadProps = async () => {
  const result = await getServerSideProps(buildContext());
  if (!result.props) throw new Error("Expected the loader to return props");
  return result.props;
};

describe("payment page getServerSideProps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue(null);
    mocks.shouldHideBrandingForEvent.mockResolvedValue(false);
  });

  it("returns notFound when the uid is missing", async () => {
    expect(await getServerSideProps(buildContext({}))).toEqual({ notFound: true });
    expect(mocks.findByUidIncludeBookingAndEventType).not.toHaveBeenCalled();
  });

  it("returns notFound when the payment does not exist", async () => {
    mocks.findByUidIncludeBookingAndEventType.mockResolvedValue(null);
    expect(await getServerSideProps(buildContext())).toEqual({ notFound: true });
    expect(mocks.findByUidIncludeBookingAndEventType).toHaveBeenCalledWith("pay_123");
  });

  it("returns notFound when the payment has no booking", async () => {
    mocks.findByUidIncludeBookingAndEventType.mockResolvedValue(buildPayment({ booking: null }));
    expect(await getServerSideProps(buildContext())).toEqual({ notFound: true });
  });

  it("returns notFound when the booking has no event type", async () => {
    mocks.findByUidIncludeBookingAndEventType.mockResolvedValue(buildPayment({}, { eventType: null }));
    expect(await getServerSideProps(buildContext())).toEqual({ notFound: true });
  });

  it("returns notFound when the event type has neither users nor a team", async () => {
    mocks.findByUidIncludeBookingAndEventType.mockResolvedValue(buildPayment({}, {}, { users: [] }));
    expect(await getServerSideProps(buildContext())).toEqual({ notFound: true });
  });

  it.each(["CANCELLED", "REJECTED"])("redirects a %s booking to its booking page", async (status) => {
    mocks.findByUidIncludeBookingAndEventType.mockResolvedValue(buildPayment({}, { status }));
    expect(await getServerSideProps(buildContext())).toEqual({
      redirect: { destination: "/booking/booking_abc", permanent: false },
    });
  });

  it("returns serializable props for a personal event type", async () => {
    mocks.findByUidIncludeBookingAndEventType.mockResolvedValue(buildPayment());
    mocks.getServerSession.mockResolvedValue({ user: { profile: { organizationId: 42 } } });
    mocks.shouldHideBrandingForEvent.mockResolvedValue(true);

    const props = await loadProps();

    expect(props.booking.startTime).toBe("2026-11-02T15:00:00.000Z");
    expect(props.booking.endTime).toBe("2026-11-02T15:30:00.000Z");
    expect(props.payment).toEqual(expect.objectContaining({ uid: "pay_123", appId: "stripe", amount: 5000 }));
    expect(props.payment).not.toHaveProperty("booking");
    expect(props.clientSecret).toBe("pi_secret");
    expect(props.user).toEqual(owner);
    expect(props.eventType.metadata).toEqual({});
    expect(props.profile).toEqual({ name: "Gary", theme: "dark", hideBranding: true });
    expect(mocks.shouldHideBrandingForEvent).toHaveBeenCalledWith({
      eventTypeId: 3,
      team: null,
      owner,
      organizationId: 42,
    });
  });

  it("uses the team name and ignores the user theme for team event types", async () => {
    const team = { name: "CronSlot Team", hideBranding: false, parent: null };
    mocks.findByUidIncludeBookingAndEventType.mockResolvedValue(
      buildPayment(
        { paymentOption: "HOLD", data: { setupIntent: { client_secret: "seti" } } },
        {},
        { users: [], team }
      )
    );

    const props = await loadProps();

    expect(props.profile).toEqual({ name: "CronSlot Team", theme: null, hideBranding: false });
    expect(props.clientSecret).toBe("seti");
    expect(mocks.shouldHideBrandingForEvent).toHaveBeenCalledWith(
      expect.objectContaining({ team, owner: null, organizationId: null })
    );
  });

  it("defaults missing payment data and booking responses to empty objects", async () => {
    mocks.findByUidIncludeBookingAndEventType.mockResolvedValue(
      buildPayment({ data: null }, { responses: null })
    );

    const props = await loadProps();

    expect(props.payment.data).toEqual({});
    expect(props.booking.responses).toEqual({});
    expect(props.clientSecret).toBe("");
  });
});

describe("getClientSecretFromPayment", () => {
  it("returns the SetupIntent client secret for HOLD payments", () => {
    expect(
      getClientSecretFromPayment({
        paymentOption: "HOLD",
        data: { setupIntent: { client_secret: "seti_secret" }, client_secret: "pi_secret" },
      })
    ).toBe("seti_secret");
  });

  it("falls back to the top-level client secret when a HOLD payment has no SetupIntent", () => {
    expect(getClientSecretFromPayment({ paymentOption: "HOLD", data: { client_secret: "pi_secret" } })).toBe(
      "pi_secret"
    );
  });

  it("returns the PaymentIntent client secret for ON_BOOKING payments", () => {
    expect(
      getClientSecretFromPayment({
        paymentOption: "ON_BOOKING",
        data: { setupIntent: { client_secret: "seti_secret" }, client_secret: "pi_secret" },
      })
    ).toBe("pi_secret");
  });

  it("returns an empty string when the payment data has no client secret", () => {
    expect(getClientSecretFromPayment({ paymentOption: null, data: {} })).toBe("");
  });
});
