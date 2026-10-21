import type { PrismaClient } from "@calcom/prisma";
import prisma from "@calcom/prisma";
import type { Prisma } from "@calcom/prisma/client";
import { paymentPageSelect } from "@calcom/prisma/selects/payment";
import type {
  BookingPaymentWithCredentials,
  CreatePaymentData,
  IBookingPaymentRepository,
  PaymentByExternalId,
  PaymentForAwaitingEmail,
  PaymentWithBookingAndEventType,
} from "./BookingPaymentRepository.interface";

export class PrismaBookingPaymentRepository implements IBookingPaymentRepository {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async findByExternalIdIncludeBookingUserCredentials(
    externalId: string,
    credentialType: string
  ): Promise<BookingPaymentWithCredentials | null> {
    return await this.prismaClient.payment.findFirst({
      where: {
        externalId,
      },
      select: {
        id: true,
        amount: true,
        success: true,
        bookingId: true,
        booking: {
          select: {
            user: {
              select: {
                credentials: {
                  where: { type: credentialType },
                  select: { key: true },
                },
              },
            },
          },
        },
      },
    });
  }

  async createPaymentRecord(data: CreatePaymentData) {
    const createdPayment = await this.prismaClient.payment.create({
      data,
    });
    return createdPayment;
  }

  async findByIdForAwaitingPaymentEmail(id: number): Promise<PaymentForAwaitingEmail | null> {
    return await this.prismaClient.payment.findUnique({
      where: { id },
      select: {
        success: true,
        externalId: true,
        uid: true,
        paymentOption: true,
        amount: true,
        currency: true,
        app: {
          select: {
            slug: true,
          },
        },
      },
    });
  }

  async findByUidIncludeBookingAndEventType(uid: string): Promise<PaymentWithBookingAndEventType | null> {
    return await this.prismaClient.payment.findUnique({
      where: { uid },
      select: paymentPageSelect,
    });
  }

  async findByExternalId(externalId: string): Promise<PaymentByExternalId | null> {
    return await this.prismaClient.payment.findFirst({
      where: { externalId },
      select: { id: true, bookingId: true, success: true, data: true },
    });
  }

  async updateDataAndBooking({
    paymentId,
    data,
    booking,
  }: {
    paymentId: number;
    data: Prisma.InputJsonValue;
    booking: Prisma.BookingUpdateInput;
  }): Promise<void> {
    await this.prismaClient.payment.update({
      where: { id: paymentId },
      data: { data, booking: { update: booking } },
      select: { id: true },
    });
  }
}
