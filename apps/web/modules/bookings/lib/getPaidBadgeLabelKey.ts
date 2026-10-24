type BadgePayment = { paymentOption?: string | null; success?: boolean | null } | undefined;

// A held card ("HOLD") is only a promise to pay; once the organizer charges the no-show
// fee the payment succeeds and the badge should say so instead of "Card held".
export function getPaidBadgeLabelKey(payment: BadgePayment): "paid" | "card_held" | "no_show_fee_charged" {
  if (payment?.paymentOption !== "HOLD") return "paid";
  return payment.success ? "no_show_fee_charged" : "card_held";
}
