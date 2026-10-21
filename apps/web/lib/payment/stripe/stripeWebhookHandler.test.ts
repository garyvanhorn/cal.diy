import { HttpError } from "@calcom/lib/http-error";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findByExternalId: vi.fn(),
  handlePaymentSuccess: vi.fn(),
  handleSetupIntentSuccess: vi.fn(),
}));

vi.mock("@calcom/prisma", () => ({ default: {} }));
vi.mock("raw-body", () => ({
  default: (req: { body: string }) => Promise.resolve(Buffer.from(req.body)),
}));
vi.mock("@calcom/features/bookings/repositories/PrismaBookingPaymentRepository", () => ({
  PrismaBookingPaymentRepository: class {
    findByExternalId = mocks.findByExternalId;
  },
}));
vi.mock("@calcom/app-store/_utils/payments/handlePaymentSuccess", () => ({
  handlePaymentSuccess: mocks.handlePaymentSuccess,
}));
vi.mock("@calcom/features/bookings/lib/payment/handleSetupIntentSuccess", () => ({
  handleSetupIntentSuccess: mocks.handleSetupIntentSuccess,
}));

import { stripeWebhookHandler } from "./stripeWebhookHandler";

const WEBHOOK_SECRET = "whsec_test_secret";
const stripe = new Stripe("sk_test_unused", { apiVersion: "2020-08-27" });

const buildEvent = (type: string, objectId: string, account: string | null = "acct_owner") =>
  JSON.stringify({ id: "evt_1", type, account, data: { object: { id: objectId } } });

const buildRequest = ({
  body,
  method = "POST",
  signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET }),
}: {
  body: string;
  method?: string;
  signature?: string | null;
}) =>
  ({
    method,
    body,
    headers: signature ? { "stripe-signature": signature } : {},
  }) as unknown as NextApiRequest;

const buildResponse = () => {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

const send = async (req: NextApiRequest) => {
  const res = buildResponse();
  await stripeWebhookHandler(req, res as unknown as NextApiResponse);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe("stripeWebhookHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
    vi.stubEnv("NEXT_PUBLIC_IS_E2E", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects non-POST requests", async () => {
    expect((await send(buildRequest({ body: "{}", method: "GET" }))).status).toBe(405);
  });

  it("rejects requests without a signature", async () => {
    expect((await send(buildRequest({ body: "{}", signature: null }))).status).toBe(400);
  });

  it("fails loudly when the webhook secret is not configured", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect((await send(buildRequest({ body: "{}" }))).status).toBe(500);
  });

  it("rejects payloads with an invalid signature", async () => {
    const body = buildEvent("payment_intent.succeeded", "pi_1");
    const result = await send(buildRequest({ body, signature: "t=1,v1=bad" }));

    expect(result).toEqual({ status: 400, body: { message: "Invalid Stripe webhook signature" } });
    expect(mocks.findByExternalId).not.toHaveBeenCalled();
  });

  it("ignores events from the platform account", async () => {
    const result = await send(buildRequest({ body: buildEvent("payment_intent.succeeded", "pi_1", null) }));

    expect(result.status).toBe(200);
    expect(mocks.findByExternalId).not.toHaveBeenCalled();
  });

  it("acknowledges unhandled event types", async () => {
    const result = await send(buildRequest({ body: buildEvent("charge.refunded", "ch_1") }));

    expect(result).toEqual({
      status: 200,
      body: { received: true, message: "Ignored Stripe event type charge.refunded" },
    });
  });

  it("acknowledges a PaymentIntent with no matching payment", async () => {
    mocks.findByExternalId.mockResolvedValue(null);
    const result = await send(buildRequest({ body: buildEvent("payment_intent.succeeded", "pi_unknown") }));

    expect(result.status).toBe(200);
    expect(mocks.findByExternalId).toHaveBeenCalledWith("pi_unknown");
    expect(mocks.handlePaymentSuccess).not.toHaveBeenCalled();
  });

  it("skips a payment that is already marked as paid", async () => {
    mocks.findByExternalId.mockResolvedValue({ id: 5, bookingId: 9, success: true, data: {} });
    const result = await send(buildRequest({ body: buildEvent("payment_intent.succeeded", "pi_1") }));

    expect(result.status).toBe(200);
    expect(mocks.handlePaymentSuccess).not.toHaveBeenCalled();
  });

  it("marks the booking paid when a PaymentIntent succeeds", async () => {
    mocks.findByExternalId.mockResolvedValue({ id: 5, bookingId: 9, success: false, data: {} });
    // handlePaymentSuccess reports success by throwing a 200
    mocks.handlePaymentSuccess.mockRejectedValue(
      new HttpError({ statusCode: 200, message: "Booking with id '9' was paid and confirmed." })
    );

    const result = await send(buildRequest({ body: buildEvent("payment_intent.succeeded", "pi_1") }));

    expect(mocks.handlePaymentSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 5, bookingId: 9, appSlug: "stripe" })
    );
    expect(result).toEqual({ status: 200, body: { message: "Booking with id '9' was paid and confirmed." } });
  });

  it("confirms the booking when a no-show fee SetupIntent succeeds", async () => {
    mocks.handleSetupIntentSuccess.mockResolvedValue("Card saved and booking 9 confirmed");

    const result = await send(buildRequest({ body: buildEvent("setup_intent.succeeded", "seti_1") }));

    expect(mocks.handleSetupIntentSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ setupIntent: expect.objectContaining({ id: "seti_1" }) })
    );
    expect(result).toEqual({
      status: 200,
      body: { received: true, message: "Card saved and booking 9 confirmed" },
    });
  });

  it("returns a 500 so Stripe retries when handling fails", async () => {
    mocks.findByExternalId.mockRejectedValue(new Error("database unavailable"));

    const result = await send(buildRequest({ body: buildEvent("payment_intent.succeeded", "pi_1") }));

    expect(result.status).toBe(500);
  });
});
