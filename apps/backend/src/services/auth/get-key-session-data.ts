import { workspaces } from "@andesine/server/database";
import { verifyAPIKey, type VerifiedAPIKey } from "#backend/lib/data";
import { toCollectionID, toKeyID, toWorkspaceID } from "@andesine/contracts/primitives";
import { db, redis } from "#backend/lib/adapters";
import { parseSessionData, type SessionData } from "#backend/lib/policy";
import { eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";

const SESSION_TTL = 300;
const assertManagerActive = ({ key, extension }: VerifiedAPIKey): void => {
  const isStopped =
    !extension?.enabled ||
    extension.disabledReason === "revoked" ||
    Boolean(extension.uninstalledAt);

  if (key.extensionID && isStopped) throw new ORPCError("UNAUTHORIZED");
};
const getKeySessionData = async (token: string): Promise<SessionData> => {
  const verified = await verifyAPIKey(token);

  if (!verified) throw new ORPCError("UNAUTHORIZED");

  assertManagerActive(verified);

  const { key } = verified;
  const cacheKey = `session:key:${key.id}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    const cachedData = parseSessionData(cached);

    // Grant changes update key rows without clearing the cache.
    if (cachedData?.key) {
      return { ...cachedData, key: { ...cachedData.key, permissions: key.permissions } };
    }

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
    key: {
      keyID: toKeyID(key.id),
      permissions: key.permissions,
      ...(key.kind === "publishable" && {
        publishable: {
          ...(key.collectionIDs.length && {
            collectionIDs: key.collectionIDs.map(toCollectionID)
          }),
          allowedOrigins: key.allowedOrigins
        }
      })
    }
  };

  await redis.set(cacheKey, JSON.stringify(data), { EX: SESSION_TTL });

  return data;
};

export { getKeySessionData };
