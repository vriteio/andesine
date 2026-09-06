// SPDX-License-Identifier: Elastic-2.0
import { config } from "#backend/lib/config";

const getEffectivePlan = (plan?: string | null): string => {
  return config.BILLING_ENABLED ? plan || "free" : "pro";
};

export { getEffectivePlan };
