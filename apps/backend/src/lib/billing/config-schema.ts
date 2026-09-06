// SPDX-License-Identifier: Elastic-2.0
import * as z from "zod";

const normalizeBillingValue = (value: unknown): unknown => {
  return typeof value === "string" ? value.trim() || undefined : value;
};
const optionalBillingString = z.preprocess(normalizeBillingValue, z.string().optional());
const billingConfigSchema = z.object({
  INCLUDED_API_CALLS: z
    .preprocess(normalizeBillingValue, z.coerce.number().int().min(0).default(1000))
    .describe("Number of API calls included in the Free plan"),
  PRO_INCLUDED_API_CALLS: z
    .preprocess(normalizeBillingValue, z.coerce.number().int().min(0).default(500000))
    .describe("Number of API calls included in the Pro plan"),
  STRIPE_SECRET_KEY: optionalBillingString.describe("Stripe secret API key"),
  STRIPE_WEBHOOK_SECRET: optionalBillingString.describe("Stripe webhook signing secret"),
  STRIPE_PRO_SEAT_PRICE_ID: optionalBillingString.describe(
    "Stripe Price ID for Pro per-seat charge"
  ),
  STRIPE_PRO_API_CALL_PRICE_ID: optionalBillingString.describe(
    "Stripe Price ID for tiered Pro API call metering"
  ),
  STRIPE_PRO_API_CALL_METER_EVENT_NAME: optionalBillingString.describe(
    "Stripe Meter event name for tracking API usage"
  )
});

const isBillingConfigured = (billing: z.infer<typeof billingConfigSchema>): boolean => {
  return Boolean(
    billing.STRIPE_SECRET_KEY &&
    billing.STRIPE_WEBHOOK_SECRET &&
    billing.STRIPE_PRO_SEAT_PRICE_ID &&
    billing.STRIPE_PRO_API_CALL_PRICE_ID &&
    billing.STRIPE_PRO_API_CALL_METER_EVENT_NAME
  );
};

export { billingConfigSchema, isBillingConfigured };
