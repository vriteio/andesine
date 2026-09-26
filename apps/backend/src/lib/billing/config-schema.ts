// SPDX-License-Identifier: Elastic-2.0
import {
  billingModeConfigSchema,
  normalizeBillingValue,
  optionalBillingString,
  requireBillingSettings
} from "@andesine/server/billing/config";
import * as z from "zod";

const billingConfigSchema = billingModeConfigSchema
  .extend({
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
  })
  .superRefine(
    requireBillingSettings([
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PRO_SEAT_PRICE_ID",
      "STRIPE_PRO_API_CALL_PRICE_ID",
      "STRIPE_PRO_API_CALL_METER_EVENT_NAME"
    ])
  );

export { billingConfigSchema };
