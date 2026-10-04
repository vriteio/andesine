// SPDX-License-Identifier: Elastic-2.0
import { config } from "#backend/lib/config";

const getEffectivePlan = (plan?: string | null): string => {
  return config.BILLING_ENABLED ? plan || "free" : "pro";
};

const AI_CREDIT_COSTS = { answer: 3, semanticSearch: 1 } as const;

export { AI_CREDIT_COSTS, getEffectivePlan };
export * from "./carry-over";
export * from "./spending";
export * from "./usage";
