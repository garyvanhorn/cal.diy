import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  confirmPayment: vi.fn(),
  confirmSetup: vi.fn(),
  bookingSuccessRedirect: vi.fn(),
  getStripe: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
}));

vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: ReactNode }) => <div data-testid="stripe-elements">{children}</div>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment: mocks.confirmPayment, confirmSetup: mocks.confirmSetup }),
  useElements: () => ({ update: vi.fn() }),
}));

vi.mock("@calcom/app-store/stripepayment/lib/client/getStripe", () => ({ default: mocks.getStripe }));

vi.mock("@calcom/features/bookings/lib/bookingSuccessRedirect", () => ({
  useBookingSuccessRedirect: () => mocks.bookingSuccessRedirect,
}));

vi.mock("@calcom/lib/hooks/useCompatSearchParams", () => ({
  useCompatSearchParams: () => new URLSearchParams("email=guest@example.com"),
}));

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, back: mocks.back }),
}));

import { StripePaymentComponent } from "./StripePaymentComponent";

type ComponentProps = Parameters<typeof StripePaymentComponent>[0];

const buildProps = (paymentOverrides: Partial<ComponentProps["payment"]> = {}): ComponentProps =>
  ({
    payment: {
      id: 1,
      uid: "pay_123",
      amount: 5000,
      currency: "usd",
      paymentOption: "ON_BOOKING",
      data: { client_secret: "pi_secret", stripe_publishable_key: "pk_test_owner" },
      ...paymentOverrides,
    },
    booking: { uid: "booking_abc", location: "integrations:google:meet" },
    eventType: { successRedirectUrl: null, forwardParamsSuccessRedirect: true },
    clientSecret: "pi_secret",
    username: "gary",
  }) as unknown as ComponentProps;

describe("StripePaymentComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads Stripe with the publishable key stored on the payment", () => {
    render(<StripePaymentComponent {...buildProps()} />);

    expect(mocks.getStripe).toHaveBeenCalledWith("pk_test_owner");
    expect(screen.getByTestId("payment-element")).toBeInTheDocument();
    expect(screen.getByText("pay_now")).toBeInTheDocument();
  });

  it("falls back to the default key when the payment has none", () => {
    render(<StripePaymentComponent {...buildProps({ data: { client_secret: "pi_secret" } })} />);

    expect(mocks.getStripe).toHaveBeenCalledWith(undefined);
  });

  it("confirms the PaymentIntent and redirects to the booking success page", async () => {
    mocks.confirmPayment.mockResolvedValue({
      paymentIntent: { id: "pi_1", client_secret: "pi_secret", status: "succeeded" },
    });
    render(<StripePaymentComponent {...buildProps()} />);

    fireEvent.click(screen.getByText("pay_now"));

    await waitFor(() => expect(mocks.bookingSuccessRedirect).toHaveBeenCalled());
    expect(mocks.confirmPayment).toHaveBeenCalledWith(
      expect.objectContaining({ redirect: "if_required", confirmParams: expect.any(Object) })
    );
    expect(mocks.bookingSuccessRedirect).toHaveBeenCalledWith(
      expect.objectContaining({
        successRedirectUrl: null,
        forwardParamsSuccessRedirect: true,
        query: {
          uid: "booking_abc",
          email: "guest@example.com",
          location: "web_conferencing_details_to_follow",
          payment_intent: "pi_1",
          payment_intent_client_secret: "pi_secret",
          redirect_status: "succeeded",
        },
      })
    );
  });

  it("shows the Stripe error and stays on the page when payment fails", async () => {
    mocks.confirmPayment.mockResolvedValue({ error: { message: "Your card was declined." } });
    render(<StripePaymentComponent {...buildProps()} />);

    fireEvent.click(screen.getByText("pay_now"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Payment failed: Your card was declined.");
    expect(mocks.bookingSuccessRedirect).not.toHaveBeenCalled();
  });

  it("requires acknowledging the no-show fee before saving the card for HOLD payments", async () => {
    mocks.confirmSetup.mockResolvedValue({
      setupIntent: { id: "seti_1", client_secret: "seti_secret", status: "succeeded" },
    });
    render(
      <StripePaymentComponent
        {...buildProps({ paymentOption: "HOLD", data: { setupIntent: { client_secret: "seti_secret" } } })}
      />
    );

    const submit = screen.getByText("submit_card").closest("button");
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(submit).toBeEnabled();
    fireEvent.click(screen.getByText("submit_card"));

    await waitFor(() => expect(mocks.confirmSetup).toHaveBeenCalled());
    expect(mocks.confirmPayment).not.toHaveBeenCalled();
    expect(mocks.bookingSuccessRedirect).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ payment_intent: "seti_1", redirect_status: "succeeded" }),
      })
    );
  });

  it("sends the attendee back to the organizer's page on cancel", () => {
    render(<StripePaymentComponent {...buildProps()} />);

    fireEvent.click(screen.getByText("cancel"));

    expect(mocks.push).toHaveBeenCalledWith("/gary");
  });
});
