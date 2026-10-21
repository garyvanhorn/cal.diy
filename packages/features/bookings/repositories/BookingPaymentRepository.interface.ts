import type { Payment, PaymentOption, Prisma } from "@calcom/prisma/client";
import type { paymentPageSelect } from "@calcom/prisma/selects/payment";
import type { JsonValue } from "@calcom/types/Json";

export interface BookingPaymentWithCredentials {
  id: number;
  amount: number;
  success: boolean;
  bookingId: number;
  booking: {
    user: {
      credentials: Array<{
        key: JsonValue;
      }>;
    } | null;
  } | null;
}

export interface CreatePaymentData {
  uid: string;
  app: { connect: { slug: string } };
  booking: { connect: { id: number } };
  amount: number;
  fee: number;
  externalId: string;
  refunded: boolean;
  success: boolean;
  currency: string;
  data: Prisma.InputJsonValue;
}

export interface PaymentForAwaitingEmail {
  success: boolean;
  externalId: string | null;
  uid: string;
  paymentOption: PaymentOption | null;
  amount: number;
  currency: string;
  app: {
    slug: string | null;
  } | null;
}

export type PaymentWithBookingAndEventType = Prisma.PaymentGetPayload<{ select: typeof paymentPageSelect }>;

export interface IBookingPaymentRepository {
  findByExternalIdIncludeBookingUserCredentials(
    externalId: string,
    credentialType: string
  ): Promise<BookingPaymentWithCredentials | null>;

  createPaymentRecord(data: CreatePaymentData): Promise<Payment>;

  findByIdForAwaitingPaymentEmail(id: number): Promise<PaymentForAwaitingEmail | null>;

  findByUidIncludeBookingAndEventType(uid: string): Promise<PaymentWithBookingAndEventType | null>;
}
