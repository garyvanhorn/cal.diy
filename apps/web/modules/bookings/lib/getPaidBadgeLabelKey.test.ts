import { describe, expect, it } from "vitest";
import { getPaidBadgeLabelKey } from "./getPaidBadgeLabelKey";

describe("getPaidBadgeLabelKey", () => {
  it("says paid for a deposit collected on booking", () => {
    expect(getPaidBadgeLabelKey({ paymentOption: "ON_BOOKING", success: true })).toBe("paid");
  });

  it("says card held while a no-show card is only saved", () => {
    expect(getPaidBadgeLabelKey({ paymentOption: "HOLD", success: false })).toBe("card_held");
  });

  it("says the no-show fee was charged once the held card is charged", () => {
    expect(getPaidBadgeLabelKey({ paymentOption: "HOLD", success: true })).toBe("no_show_fee_charged");
  });

  it("falls back to paid without payment details", () => {
    expect(getPaidBadgeLabelKey(undefined)).toBe("paid");
  });
});
