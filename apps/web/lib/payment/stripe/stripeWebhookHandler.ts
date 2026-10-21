import process from "node:process";
import { handlePaymentSuccess } from "@calcom/app-store/_utils/payments/handlePaymentSuccess";
import stripe from "@calcom/app-store/stripepayment/lib/server";
import type { IBookingPaymentRepository } from "@calcom/features/bookings/repositories/BookingPaymentRepository.interface";
import { PrismaBookingPaymentRepository } from "@calcom/features/bookings/repositories/PrismaBookingPaymentRepository";
import { HttpError as HttpCode } from "@calcom/lib/http-error";
import logger from "@calcom/lib/logger";
import { getServerErrorFromUnknown } from "@calcom/lib/server/getServerErrorFromUnknown";
import { distributedTracing } from "@calcom/lib/tracing/factory";
import prisma from "@calcom/prisma";
import type { NextApiRequest, NextApiResponse } from "next";
import getRawBody from "raw-body";
import type Stripe from "stripe";

const log = logger.getSubLogger({ prefix: ["[stripePaymentWebhook]"] });

type StripeEventHandler = (
  event: Stripe.Event,
  paymentRepository: IBookingPaymentRepository
) => Promise<string>;

const handlePaymentIntentSucceeded: StripeEventHandler = async (event, paymentRepository) => {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const payment = await paymentRepository.findByExternalId(paymentIntent.id);
  if (!payment) return `No payment found for PaymentIntent ${paymentIntent.id}`;
  if (payment.success) return `Payment ${payment.id} was already marked as paid`;

  const traceContext = distributedTracing.createTrace("stripe_payment_webhook", {
    meta: { paymentId: payment.id, bookingId: payment.bookingId },
  });
  await handlePaymentSuccess({
    paymentId: payment.id,
    bookingId: payment.bookingId,
    appSlug: "stripe",
    traceContext,
  });
  return `Payment ${payment.id} succeeded`;
};

const eventHandlers: Record<string, StripeEventHandler | undefined> = {
  "payment_intent.succeeded": handlePaymentIntentSucceeded,
};

export async function stripeWebhookHandler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") throw new HttpCode({ statusCode: 405, message: "Method Not Allowed" });

    const signature = req.headers["stripe-signature"];
    if (!signature) throw new HttpCode({ statusCode: 400, message: "Missing stripe-signature header" });

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new HttpCode({ statusCode: 500, message: "STRIPE_WEBHOOK_SECRET is not set" });

    const payload = (await getRawBody(req)).toString();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch {
      throw new HttpCode({ statusCode: 400, message: "Invalid Stripe webhook signature" });
    }

    // Booking payments are created on the organizer's connected account, so events from the
    // platform account itself (e.g. billing) are not ours to handle
    if (!event.account && !process.env.NEXT_PUBLIC_IS_E2E) {
      return res.status(200).json({ received: true, message: "Ignored event without a connected account" });
    }

    const eventHandler = eventHandlers[event.type];
    if (!eventHandler) {
      return res.status(200).json({ received: true, message: `Ignored Stripe event type ${event.type}` });
    }

    const message = await eventHandler(event, new PrismaBookingPaymentRepository(prisma));
    return res.status(200).json({ received: true, message });
  } catch (_err) {
    const err = getServerErrorFromUnknown(_err);
    // handlePaymentSuccess signals success by throwing a 200
    if (err.statusCode >= 500) log.error("Stripe webhook failed", err.message);
    return res.status(err.statusCode).json({ message: err.message });
  }
}
