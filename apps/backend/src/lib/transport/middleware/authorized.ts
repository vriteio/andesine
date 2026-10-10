import {
  AI_CREDIT_COSTS,
  estimateSpend,
  getEffectivePlan,
  getMeterPrices
} from "#backend/lib/billing";
import { Auth } from "#backend/services/auth";
import {
  assertAuthorizationRequirements,
  assertPublishableKeyAccess,
  type SessionData
} from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { base } from "../orpc";
import { isPublicAPI } from "@andesine/contracts/api/base";
import { setErrorResponseHeaders } from "../error";
import { config } from "#backend/lib/config";
import { Billing } from "#backend/services/billing";
import { enforceRateLimit, getPlanRateLimit } from "#backend/lib/security";
type Usage = Awaited<ReturnType<typeof Billing.Metering.getUsageTotals>>;
type Procedure = Parameters<Parameters<typeof base.middleware>[0]>[0]["procedure"];

const aiRateLimits = {
  answer: { scope: "ask-ai", message: "Too many Ask AI requests. Try again later." },
  semanticSearch: {
    scope: "semantic-search",
    message: "Too many semantic search requests. Try again later."
  }
} as const;

const countsAPICalls = (sessionData: SessionData, trackUsage?: false): boolean => {
  const usesAPICredentials = sessionData.type !== "session";

  return config.BILLING_ENABLED && usesAPICredentials && trackUsage !== false;
};
// Validates the input here, as oRPC validates it after this middleware.
const getAIUsage = async (procedure: Procedure, input: unknown) => {
  const { meta, inputSchema } = procedure["~orpc"];

  if (!meta.aiUsage?.when || !inputSchema) return meta.aiUsage;

  const result = await inputSchema["~standard"].validate(input);

  if (result.issues || !meta.aiUsage.when(result.value as never)) return;

  return meta.aiUsage;
};
const checkPlanAccess = (sessionData: SessionData, requireProPlan?: boolean): void => {
  if (!requireProPlan || getEffectivePlan(sessionData.subscriptionPlan) === "pro") return;

  throw new ORPCError("FORBIDDEN", {
    message: "This action requires an Andesine Pro subscription",
    data: {
      requiredPlan: "pro",
      hints: ["Ask a workspace administrator to check the subscription plan."]
    }
  });
};
const throwMonthlyLimit = (
  usage: Usage,
  limit: "api-calls" | "ai-credits" | "spending",
  message: string,
  headers?: Headers
): never => {
  const retryAfter = Math.max(Math.ceil((usage.resetDate.getTime() - Date.now()) / 1000), 1);

  headers?.set("Retry-After", `${retryAfter}`);
  throw new ORPCError("TOO_MANY_REQUESTS", {
    message,
    data: {
      limit,
      retryAfterSeconds: retryAfter,
      hints: ["Wait for the usage limit to reset, or ask a workspace admin to change it."]
    }
  });
};
const checkFreeLimit = (
  sessionData: SessionData,
  usage: Usage,
  input: { limit: "api-calls" | "ai-credits"; used: number; max: number; message: string },
  headers?: Headers
): void => {
  if (getEffectivePlan(sessionData.subscriptionPlan) === "pro" || input.used <= input.max) return;

  throwMonthlyLimit(usage, input.limit, input.message, headers);
};
const getSpending = async (sessionData: SessionData, usage: Usage) => {
  const isPro = getEffectivePlan(sessionData.subscriptionPlan) === "pro";

  if (!isPro || usage.spendingLimit === null) return null;

  const prices = await getMeterPrices().catch((error: unknown) => {
    console.error("Failed to load meter prices", { error });

    return null;
  });

  return prices && { prices, limit: usage.spendingLimit, estimated: estimateSpend(usage, prices) };
};
const setUsageHeaders = (headers: Headers | undefined, usage: Usage, added = 0): void => {
  const reset = `${Math.ceil(usage.resetDate.getTime() / 1000)}`;

  headers?.set("X-API-Usage", `${usage.apiCalls.total + added}`);
  headers?.set("X-API-Usage-Limit", `${usage.apiCalls.limit}`);
  headers?.set("X-API-Usage-Reset", reset);
};
const setAICreditHeaders = (headers: Headers | undefined, usage: Usage, added = 0): void => {
  headers?.set("X-AI-Credits", `${usage.aiCredits.total + added}`);
  headers?.set("X-AI-Credits-Limit", `${usage.aiCredits.limit}`);
  headers?.set("X-AI-Credits-Reset", `${Math.ceil(usage.resetDate.getTime() / 1000)}`);
};

const authorized = base.middleware(async ({ procedure, context, next }, input) => {
  const meta = procedure["~orpc"].meta;
  const sessionData = await Auth.getSessionData({
    headers: context.reqHeaders!,
    requireWorkspace: meta.requireWorkspace !== false
  });

  if (sessionData.extension && !sessionData.extension.active && !meta.inactiveExtensions) {
    throw new ORPCError("FORBIDDEN", {
      message: "The extension is disabled or uninstalled",
      data: { hints: ["Read the extension's state with GET /extensions/self."] }
    });
  }

  if (sessionData.type === "oauth" && !isPublicAPI(meta)) {
    throw new ORPCError("FORBIDDEN", {
      message: "OAuth credentials can only access public API operations",
      data: { hints: ["Use the Andesine app for this browser-only operation."] }
    });
  }

  assertPublishableKeyAccess(
    sessionData,
    meta.publishable === true,
    context.reqHeaders?.get("origin")
  );
  assertAuthorizationRequirements(sessionData, meta.required);
  checkPlanAccess(sessionData, meta.requireProPlan);
  await enforceRateLimit({
    scope: "api",
    key: sessionData.id,
    limit: getPlanRateLimit("api", sessionData.subscriptionPlan),
    message: "Too many requests. Try again later.",
    headers: context.resHeaders
  });

  const tracksAPICalls = countsAPICalls(sessionData, meta.trackUsage);
  const aiUsage = await getAIUsage(procedure, input);
  const aiCredits = aiUsage && config.BILLING_ENABLED ? AI_CREDIT_COSTS[aiUsage.kind] : 0;

  let usageRecorded = false;

  if (aiUsage) {
    await enforceRateLimit({
      ...aiRateLimits[aiUsage.kind],
      key: sessionData.id,
      limit: getPlanRateLimit(aiUsage.kind, sessionData.subscriptionPlan),
      headers: context.resHeaders
    });
  }

  const usage =
    tracksAPICalls || aiCredits
      ? await Billing.Metering.getUsageTotals({
          workspaceID: sessionData.workspaceID,
          plan: getEffectivePlan(sessionData.subscriptionPlan)
        })
      : undefined;

  if (usage && tracksAPICalls) {
    setUsageHeaders(context.resHeaders, usage);
    checkFreeLimit(
      sessionData,
      usage,
      {
        limit: "api-calls",
        used: usage.apiCalls.total + 1,
        max: usage.apiCalls.limit,
        message: `API request limit reached (${usage.apiCalls.limit} requests/month on the Free plan). Upgrade to Pro for higher limits.`
      },
      context.resHeaders
    );
  }

  if (usage && aiCredits) {
    setAICreditHeaders(context.resHeaders, usage);
    checkFreeLimit(
      sessionData,
      usage,
      {
        limit: "ai-credits",
        used: usage.aiCredits.total + aiCredits,
        max: usage.aiCredits.limit,
        message: `AI credit limit reached (${usage.aiCredits.limit} credits/month on the Free plan). Upgrade to Pro for more credits.`
      },
      context.resHeaders
    );
  }

  const spending = usage ? await getSpending(sessionData, usage) : null;

  const isOverSpendingLimit = Boolean(spending && spending.estimated >= spending.limit);

  if (usage && isOverSpendingLimit) {
    throwMonthlyLimit(
      usage,
      "spending",
      "Monthly spending limit reached. A workspace admin can raise it in the billing settings.",
      context.resHeaders
    );
  }

  const recordRequestUsage = async (): Promise<void> => {
    if (!usage || usageRecorded) return;

    usageRecorded = true;
    try {
      await Billing.Metering.recordUsage({
        workspaceID: sessionData.workspaceID,
        apiCalls: tracksAPICalls ? 1 : 0,
        aiCredits
      });

      if (tracksAPICalls) setUsageHeaders(context.resHeaders, usage, 1);
      if (aiCredits) setAICreditHeaders(context.resHeaders, usage, aiCredits);

      if (spending) {
        const recorded = {
          apiCalls: { ...usage.apiCalls, total: usage.apiCalls.total + (tracksAPICalls ? 1 : 0) },
          aiCredits: { ...usage.aiCredits, total: usage.aiCredits.total + aiCredits }
        };

        void Billing.Spending.sendAlerts({
          workspaceID: sessionData.workspaceID,
          estimatedSpend: estimateSpend(recorded, spending.prices),
          spendingLimit: spending.limit,
          currency: spending.prices.currency
        }).catch((error: unknown) => console.error("Failed to send spending alerts", { error }));
      }
    } catch (error) {
      console.error("Failed to record API usage", { error, workspaceID: sessionData.workspaceID });
    }
  };

  try {
    const result = await next({
      context: { auth: sessionData, recordRequestUsage }
    });

    if (meta.usageTiming !== "generation") await recordRequestUsage();

    return result;
  } catch (error) {
    setErrorResponseHeaders(error, context.resHeaders);
    throw error;
  }
});
export { authorized };
export type { SessionData };
