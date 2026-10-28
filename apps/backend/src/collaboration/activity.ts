import type { Extension, onChangePayload } from "@hocuspocus/server";
import { redis } from "#backend/lib/adapters";
import { COLLABORATION_REDIS_PREFIX } from "./redis";
import type { CollaborationContext } from "./types";

// Kept in Redis: the instance that saves a document can differ from the one that got the edit.
const CONTRIBUTORS_TTL_SECONDS = 7 * 24 * 60 * 60;
const getContributorsKey = (documentName: string): string => {
  return `${COLLABORATION_REDIS_PREFIX}:${documentName}:contributors`;
};
const getContributorID = (context?: CollaborationContext): string | undefined => {
  if (context?.contributorID) return context.contributorID;

  if (context?.auth?.type === "session") return context.auth.session?.memberID;

  return undefined;
};
// Without Redis, saves go on without attribution instead of failing.
const getPendingContributors = async (documentName: string): Promise<string[]> => {
  try {
    return await redis.sMembers(getContributorsKey(documentName));
  } catch (error) {
    console.error("Failed to read collaboration contributors", { error });
    return [];
  }
};
const clearPendingContributors = async (
  documentName: string,
  contributorIDs: string[]
): Promise<void> => {
  if (contributorIDs.length === 0) return;

  try {
    await redis.sRem(getContributorsKey(documentName), contributorIDs);
  } catch (error) {
    console.error("Failed to clear collaboration contributors", { error });
  }
};
const recordContributor = async (documentName: string, contributorID: string): Promise<void> => {
  const key = getContributorsKey(documentName);

  try {
    const added = await redis.sAdd(key, contributorID);

    if (added) await redis.expire(key, CONTRIBUTORS_TTL_SECONDS);
  } catch (error) {
    console.error("Failed to record a collaboration contributor", { error });
  }
};
const collaborationActivity: Extension<CollaborationContext> = {
  async onChange({ context, documentName }: onChangePayload<CollaborationContext>) {
    const contributorID = getContributorID(context);

    // Not awaited: the Redis extension's sync of this change runs after this hook.
    if (contributorID) void recordContributor(documentName, contributorID);
  }
};

export { clearPendingContributors, collaborationActivity, getPendingContributors };
