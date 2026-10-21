import { eventTypeAppMetadataOptionalSchema } from "@calcom/app-store/zod-utils";
import { doesBookingRequireConfirmation } from "@calcom/features/bookings/lib/doesBookingRequireConfirmation";
import EventManager, { placeholderCreatedEvent } from "@calcom/features/bookings/lib/EventManager";
import { getAllCredentialsIncludeServiceAccountKey } from "@calcom/features/bookings/lib/getAllCredentialsForUsersOnEvent/getAllCredentials";
import { handleBookingRequested } from "@calcom/features/bookings/lib/handleBookingRequested";
import { handleConfirmation } from "@calcom/features/bookings/lib/handleConfirmation";
import { getBooking } from "@calcom/features/bookings/lib/payment/getBooking";
import type { IBookingPaymentRepository } from "@calcom/features/bookings/repositories/BookingPaymentRepository.interface";
import { getPlatformParams } from "@calcom/features/platform-oauth-client/get-platform-params";
import { PlatformOAuthClientRepository } from "@calcom/features/platform-oauth-client/platform-oauth-client.repository";
import tasker from "@calcom/features/tasker";
import isPrismaObj from "@calcom/lib/isPrismaObj";
import logger from "@calcom/lib/logger";
import type { TraceContext } from "@calcom/lib/tracing";
import prisma from "@calcom/prisma";
import type { Prisma } from "@calcom/prisma/client";
import { BookingStatus } from "@calcom/prisma/enums";
import type { EventTypeMetadata } from "@calcom/prisma/zod-utils";
import type Stripe from "stripe";

const log = logger.getSubLogger({ prefix: ["[handleSetupIntentSuccess]"] });

/**
 * A no-show fee (HOLD) payment only saves the attendee's card; nothing is charged until the
 * organizer charges the fee. Saving the card is what confirms the booking.
 */
export async function handleSetupIntentSuccess({
  setupIntent,
  paymentRepository,
  traceContext,
}: {
  setupIntent: Stripe.SetupIntent;
  paymentRepository: IBookingPaymentRepository;
  traceContext: TraceContext;
}): Promise<string> {
  const payment = await paymentRepository.findByExternalId(setupIntent.id);
  if (!payment) return `No payment found for SetupIntent ${setupIntent.id}`;

  // isPrismaObj treats null as an object, so rule it out first
  const paymentData = payment.data && isPrismaObj(payment.data) ? payment.data : {};
  const storedSetupIntent = paymentData.setupIntent;
  // Stripe retries webhooks, so a second delivery must not create calendar events again
  if (storedSetupIntent && isPrismaObj(storedSetupIntent) && storedSetupIntent.status === "succeeded") {
    return `SetupIntent ${setupIntent.id} was already handled`;
  }

  const { booking, user, evt, eventType } = await getBooking(payment.bookingId);

  try {
    await tasker.cancelWithReference(booking.uid, "sendAwaitingPaymentEmail");
  } catch (error) {
    log.warn({ bookingId: booking.id, error }, "Failed to cancel the awaiting payment email task");
  }

  if (booking.location) evt.location = booking.location;

  const requiresConfirmation = doesBookingRequireConfirmation({ booking: { ...booking, eventType } });
  const allCredentials = await getAllCredentialsIncludeServiceAccountKey(user, {
    ...booking.eventType,
    metadata: booking.eventType?.metadata as EventTypeMetadata,
  });

  const platformOAuthClient = user.isPlatformManaged
    ? await new PlatformOAuthClientRepository().getByUserId(user.id)
    : null;
  const areCalendarEventsEnabled = platformOAuthClient?.areCalendarEventsEnabled ?? true;

  const bookingData: Prisma.BookingUpdateInput = { paid: true };
  if (!requiresConfirmation) {
    const apps = eventTypeAppMetadataOptionalSchema.parse(eventType?.metadata?.apps);
    const eventManager = new EventManager({ ...user, credentials: allCredentials }, apps);
    const scheduleResult = areCalendarEventsEnabled
      ? await eventManager.create(evt)
      : placeholderCreatedEvent;
    bookingData.references = { create: scheduleResult.referencesToCreate };
    bookingData.status = BookingStatus.ACCEPTED;
  }

  await paymentRepository.updateDataAndBooking({
    paymentId: payment.id,
    data: { ...paymentData, setupIntent: setupIntent as unknown as Prisma.InputJsonObject },
    booking: bookingData,
  });

  if (requiresConfirmation) {
    await handleBookingRequested({ evt, booking });
    return `Card saved for booking ${booking.id}; awaiting organizer confirmation`;
  }

  await handleConfirmation({
    user: { ...user, credentials: allCredentials },
    evt,
    prisma,
    bookingId: booking.id,
    booking,
    paid: true,
    platformClientParams: platformOAuthClient ? getPlatformParams(platformOAuthClient) : undefined,
    traceContext,
  });
  return `Card saved and booking ${booking.id} confirmed`;
}
