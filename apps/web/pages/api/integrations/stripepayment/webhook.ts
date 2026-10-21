import { stripeWebhookHandler } from "@lib/payment/stripe/stripeWebhookHandler";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default stripeWebhookHandler;
