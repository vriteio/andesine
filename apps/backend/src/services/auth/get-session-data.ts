import { auth } from "#backend/lib/adapters";
import { toUserID } from "#backend/lib/primitives";
import { getUserAuthorization, type SessionData } from "#backend/lib/policy";
import { resolveUserAuthorization } from "#backend/lib/auth/user-authorization";
import { getEffectivePlan } from "#backend/lib/billing";
import { ORPCError } from "@orpc/server";
import { getKeySessionData } from "./get-key-session-data";
import { OAuth } from "./oauth";

interface GetSessionDataInput {
  headers: Headers;
  requireWorkspace?: boolean;
}

const getSessionData = async (input: GetSessionDataInput): Promise<SessionData> => {
  const authorization = input.headers.get("authorization");
  let data: SessionData;

  if (authorization !== null) {
    const token = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1];

    if (!token) throw new ORPCError("UNAUTHORIZED");

    data = token.startsWith("and_at_")
      ? await OAuth.getSessionData({ ...input, token })
      : await getKeySessionData(token);
  } else {
    const result = await auth.api.getSession({ headers: input.headers });

    if (!result?.session) throw new ORPCError("UNAUTHORIZED");

    data = await resolveUserAuthorization({
      ...input,
      userID: toUserID(result.session.userId),
      type: "session"
    });
  }

  const subscriptionPlan = getEffectivePlan(data.subscriptionPlan);
  const user = getUserAuthorization(data);

  if (data.workspaceID && user && !user.admin && subscriptionPlan !== "pro") {
    throw new ORPCError("FORBIDDEN", {
      message: "This workspace is only available to admins while it is on the Free plan",
      data: {
        requiredPlan: "pro",
        hints: ["Ask a workspace administrator to review the subscription plan."]
      }
    });
  }

  return { ...data, subscriptionPlan };
};

export { getSessionData };
