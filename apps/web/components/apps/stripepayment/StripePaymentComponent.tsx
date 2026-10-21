"use client";

import getStripe from "@calcom/app-store/stripepayment/lib/client/getStripe";
import { useBookingSuccessRedirect } from "@calcom/features/bookings/lib/bookingSuccessRedirect";
import { WEBAPP_URL } from "@calcom/lib/constants";
import { useCompatSearchParams } from "@calcom/lib/hooks/useCompatSearchParams";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Button } from "@calcom/ui/components/button";
import { CheckboxField } from "@calcom/ui/components/form";
import type { PaymentPageProps } from "@lib/payment/[uid]/getServerSideProps";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeElementLocale, StripeElements } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import type { SyntheticEvent } from "react";
import { useEffect, useState } from "react";

type StripePaymentProps = Pick<PaymentPageProps, "payment" | "eventType" | "booking" | "clientSecret"> & {
  username: string | null;
};

type FormState = { status: "idle" } | { status: "processing" } | { status: "error"; error: Error };

type RedirectParams = {
  uid: string;
  email: string | null;
  location?: string;
  payment_intent?: string;
  payment_intent_client_secret?: string;
  redirect_status?: string;
};

const StripePaymentForm = ({
  payment,
  state,
  elements,
  onSubmit,
  onCancel,
  onPaymentElementChange,
}: {
  payment: StripePaymentProps["payment"];
  state: FormState;
  elements: StripeElements | null;
  onSubmit: (ev: SyntheticEvent) => void;
  onCancel: () => void;
  onPaymentElementChange: () => void;
}) => {
  const { t, i18n } = useLocale();
  const isHold = payment.paymentOption === "HOLD";
  const [isCanceling, setIsCanceling] = useState(false);
  // A no-show fee only charges the card later, so the attendee must explicitly accept it first
  const [holdAcknowledged, setHoldAcknowledged] = useState(!isHold);
  const disableButtons = isCanceling || !holdAcknowledged || state.status !== "idle";

  useEffect(() => {
    elements?.update({ locale: i18n.language as StripeElementLocale });
  }, [elements, i18n.language]);

  let submitLabel = t("pay_now");
  if (isHold) submitLabel = t("submit_card");

  return (
    <form id="payment-form" className="mt-4 rounded-md bg-subtle p-6" onSubmit={onSubmit}>
      <PaymentElement onChange={onPaymentElementChange} />
      {isHold && (
        <div className="mt-2 mb-5 rounded-md bg-info p-3">
          <CheckboxField
            description={t("acknowledge_booking_no_show_fee", {
              amount: payment.amount / 100,
              formatParams: { amount: { currency: payment.currency } },
            })}
            onChange={(e) => setHoldAcknowledged(e.target.checked)}
            descriptionClassName="text-info font-semibold"
          />
        </div>
      )}
      <div className="mt-2 flex justify-end space-x-2">
        <Button
          color="minimal"
          disabled={disableButtons}
          type="button"
          loading={isCanceling}
          onClick={() => {
            setIsCanceling(true);
            onCancel();
          }}>
          {t("cancel")}
        </Button>
        <Button
          type="submit"
          disabled={disableButtons}
          loading={state.status === "processing"}
          color="secondary">
          {submitLabel}
        </Button>
      </div>
      {state.status === "error" && (
        <div className="mt-4 text-center text-red-900 dark:text-gray-300" role="alert">
          {state.error.message}
        </div>
      )}
    </form>
  );
};

const StripePaymentFormContainer = (props: StripePaymentProps) => {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useCompatSearchParams();
  const stripe = useStripe();
  const elements = useElements();
  const bookingSuccessRedirect = useBookingSuccessRedirect();
  const [state, setState] = useState<FormState>({ status: "idle" });
  const { payment, booking, eventType } = props;

  const handleSubmit = async (ev: SyntheticEvent) => {
    ev.preventDefault();
    if (!stripe || !elements) return;

    setState({ status: "processing" });

    const params: RedirectParams = { uid: booking.uid, email: searchParams?.get("email") ?? null };
    let errorMessage: string | undefined;

    if (payment.paymentOption === "HOLD" && "setupIntent" in payment.data) {
      const result = await stripe.confirmSetup({ elements, redirect: "if_required" });
      errorMessage = result.error?.message;
      if (result.setupIntent) {
        params.payment_intent = result.setupIntent.id;
        params.payment_intent_client_secret = result.setupIntent.client_secret ?? undefined;
        params.redirect_status = result.setupIntent.status;
      }
    } else {
      // 3D Secure may leave the page; Stripe then sends the attendee back to the booking page
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: `${WEBAPP_URL}/booking/${booking.uid}` },
        redirect: "if_required",
      });
      errorMessage = result.error?.message;
      if (result.paymentIntent) {
        params.payment_intent = result.paymentIntent.id;
        params.payment_intent_client_secret = result.paymentIntent.client_secret ?? undefined;
        params.redirect_status = result.paymentIntent.status;
      }
    }

    if (errorMessage) {
      setState({ status: "error", error: new Error(`Payment failed: ${errorMessage}`) });
      return;
    }

    if (booking.location) {
      params.location = booking.location.includes("integration")
        ? t("web_conferencing_details_to_follow")
        : booking.location;
    }

    bookingSuccessRedirect({
      successRedirectUrl: eventType.successRedirectUrl,
      forwardParamsSuccessRedirect: eventType.forwardParamsSuccessRedirect,
      query: params,
      booking: {
        ...booking,
        startTime: new Date(booking.startTime),
        endTime: new Date(booking.endTime),
        user: { email: null, name: booking.user?.name ?? null, timeZone: booking.user?.timeZone },
      },
    });
  };

  return (
    <StripePaymentForm
      payment={payment}
      state={state}
      elements={elements}
      onSubmit={handleSubmit}
      onCancel={() => {
        if (props.username) {
          router.push(`/${props.username}`);
          return;
        }
        router.back();
      }}
      onPaymentElementChange={() => setState({ status: "idle" })}
    />
  );
};

export const StripePaymentComponent = (props: StripePaymentProps) => {
  const publishableKey = props.payment.data.stripe_publishable_key;
  const stripePromise = getStripe(typeof publishableKey === "string" ? publishableKey : undefined);
  const [theme, setTheme] = useState<"stripe" | "night">("stripe");

  useEffect(() => {
    if (document.documentElement.classList.contains("dark")) setTheme("night");
  }, []);

  return (
    <Elements stripe={stripePromise} options={{ clientSecret: props.clientSecret, appearance: { theme } }}>
      <StripePaymentFormContainer {...props} />
    </Elements>
  );
};
