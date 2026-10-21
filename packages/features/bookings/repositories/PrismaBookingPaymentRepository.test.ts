import type { PrismaClient } from "@calcom/prisma";
import { paymentPageSelect } from "@calcom/prisma/selects/payment";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaBookingPaymentRepository } from "./PrismaBookingPaymentRepository";

describe("PrismaBookingPaymentRepository", () => {
  const findUnique = vi.fn();
  const mockPrisma = { payment: { findUnique } } as unknown as PrismaClient;
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
});
