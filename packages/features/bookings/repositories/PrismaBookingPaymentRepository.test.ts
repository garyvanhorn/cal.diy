import type { PrismaClient } from "@calcom/prisma";
import { paymentPageSelect } from "@calcom/prisma/selects/payment";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaBookingPaymentRepository } from "./PrismaBookingPaymentRepository";

describe("PrismaBookingPaymentRepository", () => {
  const findUnique = vi.fn();
  const findFirst = vi.fn();
  const update = vi.fn();
  const mockPrisma = { payment: { findUnique, findFirst, update } } as unknown as PrismaClient;
  let repository: PrismaBookingPaymentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new PrismaBookingPaymentRepository(mockPrisma);
  });

  describe("findByUidIncludeBookingAndEventType", () => {
    it("queries the payment by uid with the payment page select", async () => {
      const payment = { uid: "pay_123", amount: 5000 };
      findUnique.mockResolvedValue(payment);

      const result = await repository.findByUidIncludeBookingAndEventType("pay_123");

      expect(result).toBe(payment);
      expect(findUnique).toHaveBeenCalledWith({
        where: { uid: "pay_123" },
        select: paymentPageSelect,
      });
    });

    it("returns null when no payment matches the uid", async () => {
      findUnique.mockResolvedValue(null);

      await expect(repository.findByUidIncludeBookingAndEventType("missing")).resolves.toBeNull();
    });

    it("never selects credentials", () => {
      expect(JSON.stringify(paymentPageSelect)).not.toContain("credential");
    });
  });

  describe("findByExternalId", () => {
    it("selects only the fields the Stripe webhook needs", async () => {
      const payment = { id: 5, bookingId: 9, success: false, data: {} };
      findFirst.mockResolvedValue(payment);

      await expect(repository.findByExternalId("pi_1")).resolves.toBe(payment);
      expect(findFirst).toHaveBeenCalledWith({
        where: { externalId: "pi_1" },
        select: { id: true, bookingId: true, success: true, data: true },
      });
    });
  });

  describe("updateDataAndBooking", () => {
    it("updates the payment data and its booking in one write", async () => {
      await repository.updateDataAndBooking({
        paymentId: 5,
        data: { setupIntent: { id: "seti_1" } },
        booking: { paid: true },
      });

      expect(update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { data: { setupIntent: { id: "seti_1" } }, booking: { update: { paid: true } } },
        select: { id: true },
      });
    });
  });
});
