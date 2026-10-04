import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { incrementWithExpiry, redis } from "#backend/lib/adapters/redis";
import { getEffectivePlan } from "#backend/lib/billing";

interface RateLimit {
  max: number;
  window: number;
}
interface RateLimitInput {
  key: string;
  limit: RateLimit;
  scope: string;
}
interface EnforceRateLimitInput extends RateLimitInput {
  message: string;
  headers?: Headers;
}

const RATE_LIMITS = {
  authentication: { max: 20, window: 60 },
  signIn: { max: 3, window: 10 },
  otp: { max: 3, window: 60 },
  oauthDevice: { max: 10, window: 60 },
  oauthToken: { max: 30, window: 60 },
  inviteAcceptance: { max: 20, window: 60 },
  collaboration: { max: 30, window: 60 }
} as const;
// Only a last resort against abuse; monthly quotas limit normal use.
const PLAN_RATE_LIMITS = {
  api: { free: { max: 600, window: 60 }, pro: { max: 6000, window: 60 } },
  answer: { free: { max: 60, window: 60 }, pro: { max: 600, window: 60 } },
  semanticSearch: { free: { max: 300, window: 60 }, pro: { max: 3000, window: 60 } }
} as const;

const getPlanRateLimit = (name: keyof typeof PLAN_RATE_LIMITS, plan?: string | null): RateLimit => {
  return PLAN_RATE_LIMITS[name][getEffectivePlan(plan) === "pro" ? "pro" : "free"];
};
const consumeRateLimit = async (input: RateLimitInput) => {
  const keyHash = createHash("sha256").update(input.key).digest("hex");
  const { count, ttl } = await incrementWithExpiry(
    redis,
    `rate-limit:${input.scope}:${keyHash}`,
    input.limit.window
  );

  return {
    allowed: count <= input.limit.max,
    remaining: Math.max(input.limit.max - count, 0),
    retryAfter: Math.max(ttl, 1)
  };
};
const enforceRateLimit = async (input: EnforceRateLimitInput): Promise<void> => {
  const result = await consumeRateLimit(input);

  input.headers?.set("X-RateLimit-Limit", `${input.limit.max}`);
  input.headers?.set("X-RateLimit-Remaining", `${result.remaining}`);
  input.headers?.set("X-RateLimit-Reset", `${Math.ceil(Date.now() / 1000) + result.retryAfter}`);

  if (result.allowed) return;

  input.headers?.set("Retry-After", `${result.retryAfter}`);
  throw new ORPCError("TOO_MANY_REQUESTS", {
    message: input.message,
    data: {
      limit: "rate",
      retryAfterSeconds: result.retryAfter,
      hints: ["Wait at least retryAfterSeconds before trying again."]
    }
  });
};

export { RATE_LIMITS, consumeRateLimit, enforceRateLimit, getPlanRateLimit };
