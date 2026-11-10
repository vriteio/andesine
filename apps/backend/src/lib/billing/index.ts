// SPDX-License-Identifier: Elastic-2.0
import { config } from "#backend/lib/config";

const getEffectivePlan = (plan?: string | null): string => {
  return config.BILLING_ENABLED ? plan || "free" : "pro";
};

const AI_CREDIT_COSTS = { answer: 10, semanticSearch: 1 } as const;

export { AI_CREDIT_COSTS, getEffectivePlan };
export * from "./members";
export * from "./periods";
export * from "./spending";
export * from "./usage";
