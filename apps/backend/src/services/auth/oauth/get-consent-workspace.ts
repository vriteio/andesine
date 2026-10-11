import { redis } from "#backend/lib/adapters/redis";
import { getConsentWorkspaceKey } from "#backend/lib/auth/consent-workspace";

const getConsentWorkspace = async (sessionID: string): Promise<string | undefined> => {
  return (await redis.get(getConsentWorkspaceKey(sessionID))) ?? undefined;
};

export { getConsentWorkspace };
