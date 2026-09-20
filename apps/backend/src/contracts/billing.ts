// SPDX-License-Identifier: Elastic-2.0
// License terms: apps/backend/src/services/billing/LICENSE
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
const billingUsageType = z.object({
  dailyUsage: z.array(
    z.object({
      day: z.number().int().min(1).max(31).describe("Day of the month"),
      count: z.number().int().min(0).describe("Number of API requests on that day")
    })
  ),
  totalUsage: z.number().int().min(0).describe("Total API requests in the current billing period"),
  startDate: z.date().describe("Start of the billing usage window"),
  endDate: z.date().describe("End of the billing usage window"),
  resetDate: z.date().describe("Next monthly allowance reset at 00:00 UTC"),
  limit: z.number().int().min(0).describe("Hard limit or included usage for the current plan")
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
