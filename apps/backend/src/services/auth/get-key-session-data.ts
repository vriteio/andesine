import { workspaces } from "#backend/db";
import { verifyAPIKey } from "#backend/lib/data";
import { toKeyID, toWorkspaceID } from "#backend/lib/primitives";
import { db, redis } from "#backend/lib/adapters";
import { parseSessionData, type SessionData } from "#backend/lib/policy";
import { eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";

const SESSION_TTL = 300;
const getKeySessionData = async (token: string): Promise<SessionData> => {
  const key = await verifyAPIKey(token);

  if (!key) throw new ORPCError("UNAUTHORIZED");

  const cacheKey = `session:key:${key.id}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    const cachedData = parseSessionData(cached);

    if (cachedData) return cachedData;

    await redis.del(cacheKey);
  }

  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, key.workspaceID));

  if (!workspace) throw new ORPCError("UNAUTHORIZED");

  const data: SessionData = {
    id: cacheKey,
    type: "key",
    subscriptionPlan: workspace.subscriptionPlan,
    customerID: workspace.customerID || undefined,
    workspaceID: toWorkspaceID(workspace.id),
    key: { keyID: toKeyID(key.id), permissions: key.permissions }
  };

  await redis.set(cacheKey, JSON.stringify(data), { EX: SESSION_TTL });

  return data;
};

export { getKeySessionData };
