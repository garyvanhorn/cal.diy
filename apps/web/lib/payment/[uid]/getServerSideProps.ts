import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { PrismaBookingPaymentRepository } from "@calcom/features/bookings/repositories/PrismaBookingPaymentRepository";
import { shouldHideBrandingForEvent } from "@calcom/features/profile/lib/hideBranding";
import prisma from "@calcom/prisma";
import { BookingStatus } from "@calcom/prisma/enums";
import { EventTypeMetaDataSchema } from "@calcom/prisma/zod-utils";
import type { inferSSRProps } from "@lib/types/inferSSRProps";
import type { GetServerSidePropsContext } from "next";
import { z } from "zod";

const querySchema = z.object({
  uid: z.string(),
});

const responsesSchema = z.record(z.unknown()).catch({});

function hasStringProp<T extends string>(x: unknown, key: T): x is { [key in T]: string } {
  return !!x && typeof x === "object" && key in x;
}

// Stripe stores a SetupIntent for HOLD (no-show fee) payments and a PaymentIntent otherwise
export function getClientSecretFromPayment(payment: {
  paymentOption: string | null;
  data: Record<string, unknown>;
}): string {
  if (
    payment.paymentOption === "HOLD" &&
    hasStringProp(payment.data, "setupIntent") &&
    hasStringProp(payment.data.setupIntent, "client_secret")
  ) {
    return payment.data.setupIntent.client_secret;
  }
  if (hasStringProp(payment.data, "client_secret")) {
    return payment.data.client_secret;
  }
  return "";
}

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const parsedQuery = querySchema.safeParse(context.query);
  if (!parsedQuery.success) return { notFound: true } as const;

  const paymentRepository = new PrismaBookingPaymentRepository(prisma);
  const rawPayment = await paymentRepository.findByUidIncludeBookingAndEventType(parsedQuery.data.uid);
  if (!rawPayment) return { notFound: true } as const;

  const { data, booking: rawBooking, ...restPayment } = rawPayment;
  if (!rawBooking) return { notFound: true } as const;

  const { startTime, endTime, responses, eventType, ...restBooking } = rawBooking;
  if (!eventType) return { notFound: true } as const;
  if (eventType.users.length === 0 && !eventType.team) return { notFound: true } as const;

  // A cancelled or rejected booking must never be paid for; show its status page instead
  if (rawBooking.status === BookingStatus.CANCELLED || rawBooking.status === BookingStatus.REJECTED) {
    return {
      redirect: {
        destination: `/booking/${rawBooking.uid}`,
        permanent: false,
      },
    } as const;
  }

  const payment = {
    ...restPayment,
    data: (data ?? {}) as Record<string, unknown>,
  };
  const booking = {
    ...restBooking,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    responses: responsesSchema.parse(responses),
  };

  const session = await getServerSession({ req: context.req });
  const [user] = eventType.users.length
    ? eventType.users
    : [{ id: null, name: null, username: null, theme: null, hideBranding: null }];
  const profile = {
    name: eventType.team?.name || user.name || null,
    theme: (!eventType.team?.name && user.theme) || null,
    hideBranding: await shouldHideBrandingForEvent({
      eventTypeId: eventType.id,
      team: eventType.team,
      owner: eventType.users[0] ?? null,
      organizationId: session?.user?.profile?.organizationId ?? session?.user?.org?.id ?? null,
    }),
  };

  return {
    props: {
      user,
      eventType: {
        ...eventType,
        metadata: EventTypeMetaDataSchema.parse(eventType.metadata),
      },
      booking,
      payment,
      clientSecret: getClientSecretFromPayment(payment),
      profile,
    },
  };
};

export type PaymentPageProps = inferSSRProps<typeof getServerSideProps>;
