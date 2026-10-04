// SPDX-License-Identifier: Elastic-2.0
// License terms: packages/private/contracts/src/api/LICENSE.billing
import * as z from "zod";
import { baseContract } from "./base";

const billingUrlType = z.object({
  url: z.string().url().describe("Billing URL to redirect the user to")
});
const subscriptionInfoType = z.object({
  billingEnabled: z.boolean().describe("Whether cloud billing is configured"),
  plan: z.string().describe("Current billing plan identifier"),
  status: z.string().describe("Current billing subscription status"),
  seats: z.number().int().min(0).describe("Number of billable seats in the workspace"),
  expiresAt: z.iso.datetime().nullable().describe("End of the current billing period"),
  customerID: z.string().nullable().describe("Stripe customer ID for the workspace"),
  cancelAt: z.iso.datetime().nullable().describe("Time at which the subscription will be canceled"),
  cancelAtPeriodEnd: z.boolean().describe("Whether the subscription ends after this period"),
  canceledAt: z.iso.datetime().nullable().describe("Time at which cancellation was requested"),
  endedAt: z.iso.datetime().nullable().describe("Time at which the subscription ended")
});
const meterUsageType = z.object({
  daily: z.array(
    z.object({
      day: z.number().int().min(1).max(31).describe("Day of the month"),
      count: z.number().int().min(0).describe("Usage on that day")
    })
  ),
  total: z.number().int().min(0).describe("Total usage in the current billing period"),
  limit: z.number().int().min(0).describe("Hard limit or included usage for the current plan")
});
const billingUsageType = z.object({
  apiCalls: meterUsageType.describe("API calls made with API keys or OAuth"),
  aiCredits: meterUsageType.describe("AI credits used by AI operations in the app and the API"),
  spending: z
    .object({
      limit: z
        .number()
        .int()
        .nullable()
        .describe("Monthly limit for usage charges, in cents; null for none"),
      estimated: z
        .object({
          apiCalls: z.number().int().min(0).describe("Charges for API calls, in cents"),
          aiCredits: z.number().int().min(0).describe("Charges for AI credits, in cents")
        })
        .nullable()
        .describe("Estimated usage charges of the month for each meter; null when unknown"),
      currency: z.string().nullable().describe("Currency of the charges, e.g. usd")
    })
    .nullable()
    .describe("Usage charges over the included amounts on Pro; null on Free"),
  startDate: z.date().describe("Start of the billing usage window"),
  endDate: z.date().describe("End of the billing usage window"),
  resetDate: z.date().describe("Next monthly allowance reset at 00:00 UTC")
});
const billingContract = baseContract.router({
  subscription: baseContract
    .meta({
      required: {
        session: ["read:billing"]
      }
    })
    .output(subscriptionInfoType),
  usage: baseContract
    .meta({
      required: {
        session: ["read:billing"]
      }
    })
    .output(billingUsageType),
  updateSpendingLimit: baseContract
    .meta({
      required: {
        session: ["billing"]
      }
    })
    .input(
      z.object({
        spendingLimit: z
          .number()
          .int()
          .min(100)
          .max(100_000_000)
          .nullable()
          .describe("Monthly limit for usage charges, in cents; null removes it")
      })
    ),
  checkout: baseContract
    .meta({
      required: {
        session: ["billing"]
      }
    })
    .output(billingUrlType),
  portal: baseContract
    .meta({
      required: {
        session: ["billing"]
      }
    })
    .output(billingUrlType)
});

export { billingContract };
