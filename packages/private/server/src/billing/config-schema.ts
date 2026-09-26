// SPDX-License-Identifier: Elastic-2.0
// License terms: packages/private/server/src/billing/LICENSE
import * as z from "zod";

interface BillingModeConfig {
  BILLING_ENABLED: boolean;
}

const normalizeBillingValue = (value: unknown): unknown => {
  return typeof value === "string" ? value.trim() || undefined : value;
};
const optionalBillingString = z.preprocess(normalizeBillingValue, z.string().optional());
const billingModeConfigSchema = z.object({
  BILLING_ENABLED: z
    .preprocess(normalizeBillingValue, z.stringbool())
    .describe("Enable cloud billing")
});
const requireBillingSettings = <T extends BillingModeConfig>(
  requiredSettings: ReadonlyArray<keyof T & string>
) => {
  return (config: T, context: z.RefinementCtx<T>): void => {
    if (!config.BILLING_ENABLED) return;

    for (const name of requiredSettings) {
      if (!config[name]) {
        context.addIssue({
          code: "custom",
          path: [name],
          message: `${name} is required when billing is enabled`
        });
      }
    }
  };
};

export {
  billingModeConfigSchema,
  normalizeBillingValue,
  optionalBillingString,
  requireBillingSettings
};
