import type { SessionData } from "#backend/lib/policy";
import { consumeRateLimit, RATE_LIMITS } from "#backend/lib/security";
import { ORPCError } from "@orpc/server";

const assertDeviceRequestAccess = async (auth: SessionData): Promise<void> => {
  if (auth.type !== "session" || !auth.session) throw new ORPCError("FORBIDDEN");

  const limit = await consumeRateLimit({
    scope: "cli-device-approval",
    key: auth.session.userID,
    limit: RATE_LIMITS.oauthDevice
  });

  if (!limit.allowed) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: "Too many device authorization attempts",
      data: {
        retryAfterSeconds: limit.retryAfter,
        hints: ["Wait at least retryAfterSeconds before trying again."]
      }
    });
  }
};

export { assertDeviceRequestAccess };
