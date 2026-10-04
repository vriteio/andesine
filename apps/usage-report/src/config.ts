// SPDX-License-Identifier: Elastic-2.0
import {
  billingModeConfigSchema,
  optionalBillingString,
  requireBillingSettings
} from "@andesine/server/billing/config";
import * as z from "zod";

const configSchema = billingModeConfigSchema
  .extend({
    DATABASE_URL: z.string().min(1).describe("PostgreSQL connection URL"),
    STRIPE_SECRET_KEY: optionalBillingString,
    STRIPE_PRO_API_CALL_METER_EVENT_NAME: optionalBillingString,
    STRIPE_PRO_AI_CREDIT_METER_EVENT_NAME: optionalBillingString
  })
  .superRefine(
    requireBillingSettings([
      "STRIPE_SECRET_KEY",
      "STRIPE_PRO_API_CALL_METER_EVENT_NAME",
      "STRIPE_PRO_AI_CREDIT_METER_EVENT_NAME"
    ])
  );
const config = configSchema.parse({ ...process.env });

export { config };
