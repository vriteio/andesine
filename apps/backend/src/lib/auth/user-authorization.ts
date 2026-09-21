import { memberships, roles, users, workspaces } from "#backend/db";
import { db, redis } from "#backend/lib/adapters";
import {
  toMembershipID,
  toRoleID,
  toUserID,
  toUUID,
  toWorkspaceID,
  publicID
} from "#backend/lib/primitives";
import { getUserSessionCacheKey, parseSessionData, type SessionData } from "#backend/lib/policy";
import { and, eq, isNull } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { CLI_CLIENT_ID } from "./oauth";

interface UserAuthorizationInput {
  userID: string;
  type: "session" | "oauth";
  headers: Headers;
  requireWorkspace?: boolean;
}

const SESSION_TTL = 300;
const tryResolveUUID = (id: string | undefined | null) => {
  if (!id) return null;
  try {
    return toUUID(id);
  } catch {
    return null;
  }
};
const resolveOAuthWorkspaceID = (value: string | null): string => {
  const workspaceID =
    value && publicID("ws").safeParse(value).success ? tryResolveUUID(value) : null;

  if (!workspaceID) {
    throw new ORPCError("BAD_REQUEST", {
      message: "OAuth requests require a valid x-workspace-id header",
      data: {
        hints: ["List your workspaces and send the selected workspace ID in x-workspace-id."]
      }
    });
  }

  return workspaceID;
};
const resolveUserAuthorization = async (input: UserAuthorizationInput): Promise<SessionData> => {
  const userID = toUUID(input.userID);
  const [user] = await db.select().from(users).where(eq(users.id, userID));

  if (!user || user.deletingAt) throw new ORPCError("UNAUTHORIZED");

  const basicSessionData = (): SessionData => ({
    id: `${input.type}:user:${userID}:no-workspace`,
    type: input.type,
    subscriptionPlan: "free",
    workspaceID: "",
    [input.type]: {
      ...(input.type === "oauth" && { clientID: CLI_CLIENT_ID }),
      userID: toUserID(userID),
      memberID: "",
      roleID: "",
      permissions: [],
      admin: false
    }
  });

  if (input.requireWorkspace === false) return basicSessionData();

  const requestedWorkspaceID = input.headers.get("x-workspace-id");
  const workspaceID =
    input.type === "oauth"
      ? resolveOAuthWorkspaceID(requestedWorkspaceID)
      : tryResolveUUID(requestedWorkspaceID) || user.currentWorkspaceID || null;

  if (!workspaceID) throw new ORPCError("UNAUTHORIZED");

  const cacheKey = getUserSessionCacheKey(userID, workspaceID);
  const cached = input.type === "session" ? await redis.get(cacheKey) : null;

  if (cached) {
    const cachedData = parseSessionData(cached);

    if (cachedData) return cachedData;

    await redis.del(cacheKey);
  }

  const [row] = await db
    .select({
      workspaceID: workspaces.id,
      subscriptionPlan: workspaces.subscriptionPlan,
      customerID: workspaces.customerID,
      memberID: memberships.id,
      roleID: roles.id,
      permissions: roles.permissions,
      baseRole: roles.baseRole
    })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceID))
    .innerJoin(roles, eq(roles.id, memberships.roleID))
    .where(
      and(
        eq(memberships.userID, userID),
        eq(memberships.workspaceID, workspaceID),
        isNull(workspaces.deletingAt)
      )
    );

  if (!row) throw new ORPCError("UNAUTHORIZED");

  const data: SessionData = {
    id: input.type === "session" ? cacheKey : `oauth:user:${userID}:${workspaceID}`,
    type: input.type,
    subscriptionPlan: row.subscriptionPlan,
    customerID: row.customerID || undefined,
    workspaceID: toWorkspaceID(row.workspaceID),
    [input.type]: {
      ...(input.type === "oauth" && { clientID: CLI_CLIENT_ID }),
      userID: toUserID(userID),
      memberID: toMembershipID(row.memberID),
      roleID: toRoleID(row.roleID),
      permissions: row.permissions,
      admin: row.baseRole === "admin"
    }
  };

  if (input.type === "session") {
    await redis.set(cacheKey, JSON.stringify(data), { EX: SESSION_TTL });
  }

  return data;
};
export { resolveUserAuthorization };
